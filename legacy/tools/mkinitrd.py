#!/usr/bin/env python3
"""
mkinitrd.py - Packs every regular file in a source directory into nOS's
custom initrd format, read back by vfs.c at boot.

Layout:
  [uint32 LE file_count]
  repeated file_count times:
    [32 bytes name, NUL padded/truncated]
    [uint32 LE size]
  concatenated raw file bytes, in the same order as the headers

Usage: mkinitrd.py <source_dir> <output_file>
"""

import os
import struct
import sys


def main():
    if len(sys.argv) != 3:
        print("Usage: mkinitrd.py <source_dir> <output_file>", file=sys.stderr)
        sys.exit(1)

    src_dir, out_path = sys.argv[1], sys.argv[2]

    files = sorted(
        f for f in os.listdir(src_dir)
        if os.path.isfile(os.path.join(src_dir, f))
    )

    file_data = []
    for f in files:
        with open(os.path.join(src_dir, f), "rb") as fh:
            file_data.append(fh.read())

    with open(out_path, "wb") as out:
        out.write(struct.pack("<I", len(files)))
        for f, data in zip(files, file_data):
            name_bytes = f.encode("ascii")[:31]
            name_bytes = name_bytes + b"\x00" * (32 - len(name_bytes))
            out.write(name_bytes)
            out.write(struct.pack("<I", len(data)))
        for data in file_data:
            out.write(data)

    print(f"[mkinitrd] packed {len(files)} file(s) into {out_path}")


if __name__ == "__main__":
    main()
