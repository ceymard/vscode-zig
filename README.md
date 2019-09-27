# Note by ceymard

This is a temporary fork of vscode-zig to play with a code completer. It's still pretty wonky, but if you want to try it out, checkout this repository in your `.vscode/extensions` and run `yarn` or `npm install` to install all the necessary dependencies for it to run.

Reload vscode, and voilà, zig code *should* start being completed.

# vscode-zig

[Zig](http://ziglang.org/) support for Visual Studio Code.

![Syntax Highlighting](./images/example.png)

## Features

 - syntax highlighting
 - basic compiler linting
 - automatic formatting

## Automatic Formatting

To enable automatic formatting add the `zig` command to your `PATH`, or
modify the `Zig Path` setting to point to the `zig` binary.