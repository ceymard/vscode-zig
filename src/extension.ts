'use strict';
import * as vscode from 'vscode';
import ZigCompilerProvider from './zigCompilerProvider';
import { ZigFormatProvider, ZigRangeFormatProvider } from './zigFormat';
import { ZigCompletionProvider } from './zigCompletion';

const ZIG_MODE: vscode.DocumentFilter = { language: 'zig', scheme: 'file' };

export function activate(context: vscode.ExtensionContext) {
    let compiler = new ZigCompilerProvider();
    compiler.activate(context.subscriptions);
    vscode.languages.registerCodeActionsProvider('zig', compiler);

    const zigFormatStatusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
    );
    const logChannel = vscode.window.createOutputChannel('zig');
    context.subscriptions.push(logChannel);
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            ZIG_MODE,
            new ZigFormatProvider(logChannel),
        ),
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider(
            ZIG_MODE,
            new ZigRangeFormatProvider(logChannel),
        ),
    );

    const compl_log = vscode.window.createOutputChannel('zig-complete');
    compl_log.show()
    const cmpl = new ZigCompletionProvider(compl_log)
    // vscode.languages.registerHoverProvider for variable info !
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            ZIG_MODE,
            cmpl,
            '.'
        ),
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            ZIG_MODE,
            cmpl
        ),
    );
}

export function deactivate() {
}
