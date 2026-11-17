#!/usr/bin/python3
"""nOS host bridge: lets the browser desktop see and act on the real machine.

Serves the bundled web desktop over http://127.0.0.1:8080 and exposes
read-only machine facts plus the disk installer:
  GET  /api/storage        real filesystem usage (df)
  GET  /api/disks          block devices (lsblk)
  GET  /api/files?path=    directory listing
  GET  /api/file?path=     raw file download
  DELETE /api/files?path=  delete (restricted prefixes)
  POST /api/install        {"disk": "/dev/sdX"} wipe + install nOS
  GET  /api/install/status installer progress
  POST /api/reboot         reboot the machine
"""
import json
import os
import re
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

DOCROOT = '/opt/nos'
PORT = 8080
READ_PREFIXES = ('/home/', '/media/', '/opt/', '/srv/', '/tmp/', '/usr/share/', '/var/', '/root/')
DELETE_PREFIXES = ('/home/', '/media/', '/tmp/')
SKIP_LISTING = ('/proc', '/sys', '/dev')
INSTALL_LOCK = threading.Lock()
INSTALL = {'running': False, 'done': False, 'error': '', 'log': []}


def run(cmd, **kw):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, **kw)
    except FileNotFoundError:
        return subprocess.CompletedProcess(cmd, 127, '', 'tool not found')


def api_storage():
    out = []
    r = run(['df', '-B1', '-x', 'tmpfs', '-x', 'devtmpfs', '-x', 'squashfs', '-x', 'overlay',
             '--output=source,size,used,avail,pcent,target'])
    for line in (r.stdout or '').splitlines()[1:]:
        parts = line.split()
        if len(parts) != 6 or not parts[0].startswith('/dev/'):
            continue
        out.append({'fs': parts[0], 'total': int(parts[1]), 'used': int(parts[2]),
                    'free': int(parts[3]), 'pct': int(parts[4].rstrip('%')), 'target': parts[5]})
    return {'filesystems': out}


def api_disks():
    r = run(['lsblk', '-J', '-b', '-o', 'NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,MODEL'])
    if r.returncode == 0:
        return json.loads(r.stdout)
    return {'blockdevices': []}


def api_battery():
    out = {'batteries': [], 'ac': False}
    base = '/sys/class/power_supply'
    try:
        for name in sorted(os.listdir(base)):
            p = os.path.join(base, name)
            try:
                with open(p + '/type') as f:
                    t = f.read().strip()
            except OSError:
                continue
            if t == 'Battery':
                pct, st = 0, 'unknown'
                try:
                    with open(p + '/capacity') as f:
                        pct = int(f.read().strip())
                except (OSError, ValueError):
                    try:
                        with open(p + '/energy_now') as f:
                            now = int(f.read().strip())
                        with open(p + '/energy_full') as f:
                            full = int(f.read().strip())
                        pct = int(100 * now / full) if full else 0
                    except (OSError, ValueError):
                        pass
                try:
                    with open(p + '/status') as f:
                        st = f.read().strip().lower()
                except OSError:
                    pass
                out['batteries'].append({'name': name, 'pct': pct, 'status': st})
            elif t == 'Mains':
                try:
                    with open(p + '/online') as f:
                        if f.read().strip() == '1':
                            out['ac'] = True
                except OSError:
                    pass
    except OSError:
        pass
    return out


def api_network():
    out = {'wifi_on': False, 'state': '', 'connections': [], 'networks': []}
    r = run(['nmcli', '-t', '-f', 'STATE', 'general', 'status'])
    out['state'] = (r.stdout or '').strip().lower()
    r = run(['nmcli', '-t', 'radio', 'wifi'])
    out['wifi_on'] = 'enabled' in (r.stdout or '')
    r = run(['nmcli', '-t', '-f', 'NAME,DEVICE,TYPE', 'con', 'show', '--active'])
    for line in (r.stdout or '').splitlines():
        p = line.split(':')
        if len(p) >= 2:
            out['connections'].append({'name': p[0], 'device': p[1]})
    r = run(['nmcli', '-t', '-f', 'ACTIVE,SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list', '--rescan', 'no'])
    for line in (r.stdout or '').splitlines():
        p = line.split(':')
        if len(p) < 4:
            continue
        active = p[0] == 'yes'
        security = p[-1]
        try:
            signal = int(p[-2])
        except ValueError:
            signal = 0
        ssid = ':'.join(p[1:-2]) if len(p) > 4 else p[1]
        if ssid:
            out['networks'].append({'ssid': ssid, 'signal': signal,
                                    'security': security, 'active': active})
    seen, uniq = set(), []
    for n in out['networks']:
        if n['ssid'] not in seen:
            seen.add(n['ssid'])
            uniq.append(n)
    out['networks'] = uniq
    return out


def api_bluetooth():
    out = {'powered': False, 'adapter': False, 'devices': []}
    r = run(['bluetoothctl', 'show'])
    if r.returncode == 0:
        out['adapter'] = True
        out['powered'] = 'Powered: yes' in (r.stdout or '')
    for sub in ('Connected', 'Devices'):
        r = run(['bluetoothctl', 'devices', sub])
        for line in (r.stdout or '').splitlines():
            p = line.split()
            if len(p) >= 3 and p[0] == 'Device':
                mac, name = p[1], ' '.join(p[2:])
                if not any(d['mac'] == mac for d in out['devices']):
                    out['devices'].append({'mac': mac, 'name': name,
                                           'connected': sub == 'Connected'})
    return out


def safe_path(qs, prefixes):
    path = os.path.realpath(unquote(qs.get('path', [''])[0]))
    if not any(path.startswith(p) for p in prefixes):
        return None
    return path


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        pass

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        if u.path == '/api/storage':
            return self.send_json(api_storage())
        if u.path == '/api/disks':
            return self.send_json(api_disks())
        if u.path == '/api/battery':
            return self.send_json(api_battery())
        if u.path == '/api/network':
            return self.send_json(api_network())
        if u.path == '/api/bluetooth':
            return self.send_json(api_bluetooth())
        if u.path == '/api/status':
            return self.send_json({'battery': api_battery(), 'network': api_network(),
                                   'bluetooth': api_bluetooth(), 'online': os.path.exists('/run/nm-online') or api_network()['state'] not in ('', 'disconnected', 'asleep')})
        if u.path == '/api/install/status':
            return self.send_json({**{k: v for k, v in INSTALL.items()},
                                   'log': '\n'.join(INSTALL['log'][-40:])})
        if u.path == '/api/files':
            path = safe_path(qs, READ_PREFIXES)
            if not path or any(path == p or path.startswith(p + '/') for p in SKIP_LISTING):
                return self.send_json({'error': 'forbidden'}, 403)
            if not os.path.isdir(path):
                return self.send_json({'error': 'not found'}, 404)
            entries = []
            try:
                for name in sorted(os.listdir(path), key=str.lower):
                    if name.startswith('.'):
                        continue
                    full = os.path.join(path, name)
                    st = os.lstat(full)
                    entries.append({'name': name, 'path': full, 'dir': os.path.isdir(full)
                                    and not os.path.islink(full), 'size': st.st_size,
                                    'mtime': int(st.st_mtime)})
                entries.sort(key=lambda e: (not e['dir'], e['name'].lower()))
            except PermissionError:
                return self.send_json({'error': 'permission denied'}, 403)
            return self.send_json({'path': path, 'entries': entries})
        if u.path == '/api/file':
            path = safe_path(qs, READ_PREFIXES)
            if not path or not os.path.isfile(path):
                return self.send_json({'error': 'not found'}, 404)
            try:
                with open(path, 'rb') as f:
                    data = f.read()
            except PermissionError:
                return self.send_json({'error': 'permission denied'}, 403)
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', 'attachment; filename="%s"'
                             % os.path.basename(path).replace('"', ''))
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if u.path == '/' or u.path == '/index.html':
            self.send_response(302)
            self.send_header('Location', '/lemonos/index.html')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        return self.serve_static(u.path)

    def serve_static(self, path):
        rel = os.path.normpath(unquote(path)).lstrip('/')
        full = os.path.realpath(os.path.join(DOCROOT, rel))
        if os.path.isdir(full):
            full = os.path.join(full, 'index.html')
        if not full.startswith(DOCROOT + '/') or not os.path.isfile(full):
            return self.send_json({'error': 'not found'}, 404)
        ctype = 'application/octet-stream'
        if full.endswith(('.html', '.htm')):
            ctype = 'text/html; charset=utf-8'
        elif full.endswith('.css'):
            ctype = 'text/css'
        elif full.endswith('.js'):
            ctype = 'application/javascript'
        elif full.endswith('.svg'):
            ctype = 'image/svg+xml'
        elif full.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico')):
            ctype = 'image/' + full.rsplit('.', 1)[1].replace('jpg', 'jpeg')
        elif full.endswith('.json'):
            ctype = 'application/json'
        elif full.endswith('.woff2'):
            ctype = 'font/woff2'
        with open(full, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)

    def do_DELETE(self):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        path = safe_path(qs, DELETE_PREFIXES)
        if not path:
            return self.send_json({'error': 'forbidden'}, 403)
        try:
            if os.path.isdir(path) and not os.path.islink(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            return self.send_json({'ok': True})
        except OSError as e:
            return self.send_json({'error': str(e)}, 400)

    def do_POST(self):
        u = urlparse(self.path)
        length = int(self.headers.get('Content-Length') or 0)
        body = {}
        if length:
            try:
                body = json.loads(self.rfile.read(length) or b'{}')
            except ValueError:
                return self.send_json({'error': 'bad json'}, 400)
        if u.path == '/api/install':
            disk = body.get('disk', '')
            if not re.fullmatch(r'/dev/(sd[a-z]|nvme[0-9]+|vd[a-z]|mmcblk[0-9]+)', disk or ''):
                return self.send_json({'error': 'bad disk'}, 400)
            with INSTALL_LOCK:
                if INSTALL['running']:
                    return self.send_json({'error': 'install already running'}, 409)
                INSTALL.update(running=True, done=False, error='', log=[])
            threading.Thread(target=do_install, args=(disk,), daemon=True).start()
            return self.send_json({'ok': True})
        if u.path == '/api/reboot':
            subprocess.Popen(['systemctl', 'reboot'])
            return self.send_json({'ok': True})
        if u.path == '/api/wifi/connect':
            ssid, pw = body.get('ssid', ''), body.get('pass', '')
            if not ssid:
                return self.send_json({'error': 'no ssid'}, 400)
            cmd = ['nmcli', 'dev', 'wifi', 'connect', ssid]
            if pw:
                cmd += ['password', pw]
            r = run(cmd, timeout=60)
            if r.returncode:
                return self.send_json({'error': (r.stderr or r.stdout).strip()[-200:]}, 400)
            return self.send_json({'ok': True})
        if u.path == '/api/wifi/toggle':
            r = run(['nmcli', 'radio', 'wifi', 'on' if body.get('on') else 'off'])
            return self.send_json({'ok': r.returncode == 0})
        if u.path == '/api/bluetooth/toggle':
            r = run(['bluetoothctl', 'power', 'on' if body.get('on') else 'off'], timeout=15)
            return self.send_json({'ok': r.returncode == 0})
        if u.path == '/api/bluetooth/scan':
            run(['bluetoothctl', 'scan', 'on'], timeout=2)
            time.sleep(6)
            run(['bluetoothctl', 'scan', 'off'], timeout=5)
            return self.send_json(api_bluetooth())
        if u.path == '/api/bluetooth/connect':
            mac = body.get('mac', '')
            if not re.fullmatch(r'([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}', mac or ''):
                return self.send_json({'error': 'bad mac'}, 400)
            r = run(['bluetoothctl', 'connect', mac], timeout=30)
            if r.returncode:
                run(['bluetoothctl', 'trust', mac], timeout=15)
                r = run(['bluetoothctl', 'connect', mac], timeout=30)
            if r.returncode:
                return self.send_json({'error': (r.stderr or r.stdout).strip()[-200:] or 'connection failed'}, 400)
            return self.send_json({'ok': True})
        return self.send_json({'error': 'not found'}, 404)


def log(msg):
    INSTALL['log'].append('[%s] %s' % (time.strftime('%H:%M:%S'), msg))


def squashfs_source():
    for cand in ('/run/live/medium/live/filesystem.squashfs',
                 '/lib/live/medium/live/filesystem.squashfs',
                 '/run/live/patch/live/filesystem.squashfs'):
        if os.path.exists(cand):
            return cand
    return None


def do_install(disk):
    T = '/mnt/nos-target'
    try:
        log('Install target: ' + disk)
        if not os.path.exists(disk):
            raise RuntimeError('disk not found')
        r = run(['wipefs', '-a', disk])
        if r.returncode:
            raise RuntimeError('wipefs: ' + r.stderr.strip())
        for cmd in (['parted', '-s', disk, 'mklabel', 'gpt'],
                    ['parted', '-s', disk, 'mkpart', 'ESP', 'fat32', '1MiB', '513MiB'],
                    ['parted', '-s', disk, 'set', '1', 'esp', 'on'],
                    ['parted', '-s', disk, 'mkpart', 'root', 'ext4', '513MiB', '100%']):
            r = run(cmd)
            if r.returncode:
                raise RuntimeError('parted: ' + r.stderr.strip())
        r = run(['partprobe', disk])
        time.sleep(2)
        p1, p2 = disk + 'p1', disk + 'p2'
        if not os.path.exists(p1):
            p1, p2 = disk + '1', disk + '2'
        for cmd, part in ((['mkfs.vfat', '-F32', p1], p1), (['mkfs.ext4', '-F', p2], p2)):
            r = run(cmd)
            if r.returncode:
                raise RuntimeError('mkfs %s: %s' % (part, r.stderr.strip()))
        log('Partitions created')
        shutil.rmtree(T, ignore_errors=True)
        os.makedirs(T + '/boot/efi', exist_ok=True)
        r = run(['mount', p2, T])
        if r.returncode:
            raise RuntimeError('mount root: ' + r.stderr.strip())
        r = run(['mount', p1, T + '/boot/efi'])
        if r.returncode:
            raise RuntimeError('mount esp: ' + r.stderr.strip())
        src = squashfs_source()
        if not src:
            raise RuntimeError('live squashfs not found')
        log('Copying system (this takes a few minutes)...')
        r = run(['unsquashfs', '-f', '-d', T, src], timeout=3600)
        if r.returncode:
            raise RuntimeError('unsquashfs: ' + (r.stderr or r.stdout).strip()[-300:])
        log('System copied; configuring bootloader')
        ruid = run(['blkid', '-s', 'UUID', '-o', 'value', p2]).stdout.strip()
        euid = run(['blkid', '-s', 'UUID', '-o', 'value', p1]).stdout.strip()
        with open(T + '/etc/fstab', 'w') as f:
            f.write('UUID=%s / ext4 errors=remount-ro 0 1\n' % ruid)
            f.write('UUID=%s /boot/efi vfat defaults 0 2\n' % euid)
        for m in ('/dev', '/dev/pts', '/proc', '/sys'):
            r = run(['mount', '--bind', m, T + m])
            if r.returncode:
                raise RuntimeError('bind %s: %s' % (m, r.stderr.strip()))
        for cmd in (['grub-install', '--target=x86_64-efi', '--efi-directory=/boot/efi',
                     '--boot-directory=/boot', '--removable'],
                    ['grub-install', '--target=i386-pc', disk],
                    ['update-grub']):
            r = run(['chroot', T] + cmd, timeout=1200)
            if r.returncode and cmd[1] != 'i386-pc':
                raise RuntimeError(' '.join(cmd) + ': ' + r.stderr.strip()[-300:])
            log('done: ' + ' '.join(cmd))
        for m in ('/dev/pts', '/dev', '/proc', '/sys'):
            run(['umount', '-l', T + m])
        run(['umount', T + '/boot/efi'])
        run(['umount', T])
        INSTALL['done'] = True
        log('INSTALL COMPLETE - you can reboot into your new nOS now')
    except Exception as e:
        INSTALL['error'] = str(e)
        log('ERROR: ' + str(e))
        for m in ('/dev/pts', '/dev', '/proc', '/sys', '/boot/efi', T):
            run(['umount', '-l', m])
    finally:
        INSTALL['running'] = False


if __name__ == '__main__':
    os.makedirs('/opt/nos', exist_ok=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
