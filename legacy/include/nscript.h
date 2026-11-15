#ifndef NSCRIPT_H
#define NSCRIPT_H

// nScript: a small original Lua-inspired interpreter, NOT a port of real
// Lua (which needs setjmp/longjmp, libm float support, and libc string/
// number formatting that this freestanding kernel doesn't have -- porting
// it blind, with no way to actually run and test it, would risk shipping
// something that looks complete but silently doesn't work).
//
// Supports: single-letter integer variables (a-z), +,-,*,/,%, comparisons
// (==,!=,<,>,<=,>=), if/then/else/end, while/do/end, print(expr|"string"),
// and two OS-control builtins: setbg(n) and launch("appname"). Statements
// on one line are separated by ';'. No multi-line programs (REPL-style,
// one line at a time) and no function calls inside expressions.

typedef void (*nscript_print_fn)(const char *text);
typedef void (*nscript_setbg_fn)(int index);
typedef void (*nscript_launch_fn)(const char *app_name);

void nscript_init(nscript_print_fn print_cb, nscript_setbg_fn setbg_cb, nscript_launch_fn launch_cb);

// Parses and executes one line. Errors are reported via the print
// callback ("SYNTAX ERROR") rather than returned, to keep call sites simple.
void nscript_run_line(const char *line);

#endif
