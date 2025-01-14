'use strict';
import * as vscode from 'vscode';
import { ZigCompletionProvider } from './zigCompletion';

const ZIG_MODE: vscode.DocumentFilter = { language: 'zig', scheme: 'file' };

export function activate(context: vscode.ExtensionContext) {

    const compl_log = vscode.window.createOutputChannel('zig-complete');
    // compl_log.show()
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

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            ZIG_MODE,
            cmpl
        )
    );

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            ZIG_MODE,
            cmpl
        )
    );
}

export function deactivate() {
}
