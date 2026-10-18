// nscript.c - A small, original, hand-traced-for-correctness recursive-
// descent interpreter. See nscript.h for scope and rationale.
//
// Implementation note on if/while: every parse function takes an `exec`
// flag. When exec=0, expressions are still evaluated (reading variables
// has no side effects, so this is always safe) but assignments, print(),
// and setbg()/launch() calls are suppressed. This lets an untaken if-
// branch, or a while loop whose condition starts false, still be parsed
// (to correctly locate its matching 'end') without actually running it.
// while loops re-parse their body text from a saved pointer on each
// iteration -- no AST is built, this is a pure tree-walking interpreter.

#include <stdint.h>
#include "nscript.h"

#define MAX_IDENT 16
#define MAX_LOOP_ITERATIONS 100000

typedef struct {
    const char *p;
    int error;
} parser_t;

static nscript_print_fn g_print;
static nscript_setbg_fn g_setbg;
static nscript_launch_fn g_launch;
static int32_t g_vars[26];

void nscript_init(nscript_print_fn print_cb, nscript_setbg_fn setbg_cb, nscript_launch_fn launch_cb) {
    g_print = print_cb;
    g_setbg = setbg_cb;
    g_launch = launch_cb;
    for (int i = 0; i < 26; i++) g_vars[i] = 0;
}

static void skip_ws(parser_t *ps) {
    while (*ps->p == ' ') ps->p++;
}

static int match_char(parser_t *ps, char c) {
    skip_ws(ps);
    if (*ps->p == c) { ps->p++; return 1; }
    return 0;
}

static int read_ident(parser_t *ps, char *out, int max_len) {
    skip_ws(ps);
    int n = 0;
    while (ps->p[n] >= 'a' && ps->p[n] <= 'z' && n < max_len - 1) {
        out[n] = ps->p[n];
        n++;
    }
    out[n] = '\0';
    ps->p += n;
    return n;
}

static int match_keyword(parser_t *ps, const char *kw) {
    const char *save = ps->p;
    skip_ws(ps);
    const char *p = ps->p;
    int i = 0;
    while (kw[i] && p[i] == kw[i]) i++;
    if (kw[i] == '\0') {
        char next = p[i];
        if (!(next >= 'a' && next <= 'z')) {
            ps->p = p + i;
            return 1;
        }
    }
    ps->p = save;
    return 0;
}

static int32_t read_number(parser_t *ps) {
    skip_ws(ps);
    int32_t val = 0;
    int any = 0;
    while (*ps->p >= '0' && *ps->p <= '9') {
        val = val * 10 + (*ps->p - '0');
        ps->p++;
        any = 1;
    }
    if (!any) ps->error = 1;
    return val;
}

static int32_t parse_expr(parser_t *ps, int exec);

static int32_t parse_factor(parser_t *ps, int exec) {
    skip_ws(ps);
    if (*ps->p == '-') {
        ps->p++;
        return -parse_factor(ps, exec);
    }
    if (*ps->p == '(') {
        ps->p++;
        int32_t v = parse_expr(ps, exec);
        if (!match_char(ps, ')')) ps->error = 1;
        return v;
    }
    if (*ps->p >= '0' && *ps->p <= '9') {
        return read_number(ps);
    }
    if (*ps->p >= 'a' && *ps->p <= 'z') {
        char name[MAX_IDENT];
        read_ident(ps, name, MAX_IDENT);
        if (name[1] == '\0') {
            return g_vars[name[0] - 'a'];
        }
        ps->error = 1; // multi-letter identifiers aren't valid inside expressions
        return 0;
    }
    ps->error = 1;
    return 0;
}

static int32_t parse_term(parser_t *ps, int exec) {
    int32_t v = parse_factor(ps, exec);
    for (;;) {
        skip_ws(ps);
        char op = *ps->p;
        if (op == '*') { ps->p++; v = v * parse_factor(ps, exec); }
        else if (op == '/') {
            ps->p++;
            int32_t d = parse_factor(ps, exec);
            v = (d != 0) ? v / d : 0;
        } else if (op == '%') {
            ps->p++;
            int32_t d = parse_factor(ps, exec);
            v = (d != 0) ? v % d : 0;
        } else break;
    }
    return v;
}

static int32_t parse_addsub(parser_t *ps, int exec) {
    int32_t v = parse_term(ps, exec);
    for (;;) {
        skip_ws(ps);
        char op = *ps->p;
        if (op == '+') { ps->p++; v = v + parse_term(ps, exec); }
        else if (op == '-') { ps->p++; v = v - parse_term(ps, exec); }
        else break;
    }
    return v;
}

static int32_t parse_expr(parser_t *ps, int exec) {
    int32_t v = parse_addsub(ps, exec);
    skip_ws(ps);
    if (ps->p[0] == '=' && ps->p[1] == '=') { ps->p += 2; v = (v == parse_addsub(ps, exec)); }
    else if (ps->p[0] == '!' && ps->p[1] == '=') { ps->p += 2; v = (v != parse_addsub(ps, exec)); }
    else if (ps->p[0] == '<' && ps->p[1] == '=') { ps->p += 2; v = (v <= parse_addsub(ps, exec)); }
    else if (ps->p[0] == '>' && ps->p[1] == '=') { ps->p += 2; v = (v >= parse_addsub(ps, exec)); }
    else if (ps->p[0] == '<') { ps->p += 1; v = (v < parse_addsub(ps, exec)); }
    else if (ps->p[0] == '>') { ps->p += 1; v = (v > parse_addsub(ps, exec)); }
    return v;
}

static void int_to_str(int32_t val, char *out) {
    char tmp[12];
    int neg = val < 0;
    uint32_t uv = neg ? (uint32_t)(-(val + 1)) + 1u : (uint32_t)val;
    int i = 0;
    if (uv == 0) { out[0] = '0'; out[1] = '\0'; return; }
    while (uv > 0 && i < 11) { tmp[i++] = (char)('0' + (uv % 10)); uv /= 10; }
    int j = 0;
    if (neg) out[j++] = '-';
    while (i > 0) out[j++] = tmp[--i];
    out[j] = '\0';
}

static void parse_stmt_list(parser_t *ps, int exec);

static void parse_print(parser_t *ps, int exec) {
    if (!match_char(ps, '(')) { ps->error = 1; return; }
    skip_ws(ps);
    if (*ps->p == '"') {
        ps->p++;
        char buf[80];
        int n = 0;
        while (*ps->p && *ps->p != '"' && n < 79) { buf[n++] = *ps->p; ps->p++; }
        buf[n] = '\0';
        if (*ps->p == '"') ps->p++; else { ps->error = 1; return; }
        if (exec && g_print) g_print(buf);
    } else {
        int32_t v = parse_expr(ps, exec);
        if (exec && g_print) {
            char buf[16];
            int_to_str(v, buf);
            g_print(buf);
        }
    }
    if (!match_char(ps, ')')) ps->error = 1;
}

static void parse_call(parser_t *ps, int exec, const char *name) {
    if (!match_char(ps, '(')) { ps->error = 1; return; }

    int is_setbg = (name[0]=='s'&&name[1]=='e'&&name[2]=='t'&&name[3]=='b'&&name[4]=='g'&&name[5]=='\0');
    int is_launch = (name[0]=='l'&&name[1]=='a'&&name[2]=='u'&&name[3]=='n'&&name[4]=='c'&&name[5]=='h'&&name[6]=='\0');

    if (is_setbg) {
        int32_t v = parse_expr(ps, exec);
        if (exec && g_setbg) g_setbg((int)v);
    } else if (is_launch) {
        skip_ws(ps);
        if (*ps->p != '"') { ps->error = 1; return; }
        ps->p++;
        char buf[32];
        int n = 0;
        while (*ps->p && *ps->p != '"' && n < 31) { buf[n++] = *ps->p; ps->p++; }
        buf[n] = '\0';
        if (*ps->p == '"') ps->p++; else { ps->error = 1; return; }
        if (exec && g_launch) g_launch(buf);
    } else {
        ps->error = 1;
    }

    if (!match_char(ps, ')')) ps->error = 1;
}

static void parse_if(parser_t *ps, int exec) {
    int32_t cond = parse_expr(ps, exec);
    if (!match_keyword(ps, "then")) { ps->error = 1; return; }

    parse_stmt_list(ps, exec && cond);

    if (match_keyword(ps, "else")) {
        parse_stmt_list(ps, exec && !cond);
    }

    if (!match_keyword(ps, "end")) ps->error = 1;
}

static void parse_while(parser_t *ps, int exec) {
    const char *cond_start = ps->p;
    int32_t cond = parse_expr(ps, 1);
    if (!match_keyword(ps, "do")) { ps->error = 1; return; }
    const char *body_start = ps->p;

    if (!exec) {
        parse_stmt_list(ps, 0);
        if (!match_keyword(ps, "end")) ps->error = 1;
        return;
    }

    int guard = 0;
    while (cond && !ps->error && guard < MAX_LOOP_ITERATIONS) {
        guard++;
        ps->p = body_start;
        parse_stmt_list(ps, 1);
        ps->p = cond_start;
        cond = parse_expr(ps, 1);
    }

    if (guard == 0) {
        ps->p = body_start;
        parse_stmt_list(ps, 0);
    }

    if (!match_keyword(ps, "end")) ps->error = 1;
}

static void parse_stmt(parser_t *ps, int exec) {
    skip_ws(ps);
    if (*ps->p == '\0') return;

    if (match_keyword(ps, "if")) { parse_if(ps, exec); return; }
    if (match_keyword(ps, "while")) { parse_while(ps, exec); return; }
    if (match_keyword(ps, "print")) { parse_print(ps, exec); return; }

    if (*ps->p >= 'a' && *ps->p <= 'z') {
        char name[MAX_IDENT];
        const char *save = ps->p;
        read_ident(ps, name, MAX_IDENT);

        skip_ws(ps);
        if (*ps->p == '(') {
            parse_call(ps, exec, name);
            return;
        }
        if (name[1] == '\0' && *ps->p == '=' && ps->p[1] != '=') {
            ps->p++;
            int32_t v = parse_expr(ps, exec);
            if (exec) g_vars[name[0] - 'a'] = v;
            return;
        }
        ps->p = save;
    }

    ps->error = 1;
}

static void parse_stmt_list(parser_t *ps, int exec) {
    for (;;) {
        skip_ws(ps);
        if (*ps->p == '\0') return;
        if (ps->p[0]=='e' && ps->p[1]=='n' && ps->p[2]=='d' && !(ps->p[3]>='a'&&ps->p[3]<='z')) return;
        if (ps->p[0]=='e' && ps->p[1]=='l' && ps->p[2]=='s' && ps->p[3]=='e' && !(ps->p[4]>='a'&&ps->p[4]<='z')) return;

        parse_stmt(ps, exec);
        if (ps->error) return;

        skip_ws(ps);
        if (*ps->p == ';') { ps->p++; continue; }
        return;
    }
}

void nscript_run_line(const char *line) {
    parser_t ps;
    ps.p = line;
    ps.error = 0;

    parse_stmt_list(&ps, 1);

    skip_ws(&ps);
    if (!ps.error && *ps.p != '\0') ps.error = 1; // trailing garbage

    if (ps.error && g_print) {
        g_print("SYNTAX ERROR");
    }
}
