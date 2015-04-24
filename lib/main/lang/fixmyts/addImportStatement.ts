import { QuickFix, QuickFixQueryInformation, Refactoring} from "./quickFix";
import * as ts from "typescript";
import * as ast from "./astUtils";
import {EOL } from "os";
import { displayPartsToString, typeToDisplayParts } from "typescript";

import {getExternalModuleNames } from "../modules/getExternalModules";

function getIdentifierAndFileNames(error: ts.Diagnostic, getRelativePathsInProject: Function) {

    var errorText: string = <any>error.messageText;
    if (typeof errorText !== 'string') {
        console.error('I have no idea what this is:', errorText);
        return undefined;
    };

    var match = errorText.match(/Cannot find name \'(\w+)\'./);

    // Happens when the type name is an alias. We can't refactor in this case anyways
    if (!match) return;
    var [, identifierName] = match;
    var {files} = getRelativePathsInProject({ filePath: error.file.fileName, prefix: identifierName, includeExternalModules: false });
    var file = files.length > 0 ? files[0].relativePath : undefined;
    var basename = files.length > 0 ? files[0].name : undefined;
    return {identifierName,file,basename };
}

class AddImportStatement implements QuickFix {
    key = AddImportStatement.name;
    constructor(private getRelativePathsInProject: Function) {
    }
    canProvideFix(info: QuickFixQueryInformation): string {
        var relevantError = info.positionErrors.filter(x=> x.code == 2304)[0];
        if (!relevantError) return;
        if (info.positionNode.kind !== ts.SyntaxKind.Identifier) return;

        // TODO: use type checker to see if item of `.` before hand is a class
        //  But for now just run with it.

        // var match = getIdentifierAndFileNames(relevantError);
        //
        // if(!match) return;
        //
        // var {identifierName, className} = match;
        var { identifierName, file} = getIdentifierAndFileNames(relevantError, this.getRelativePathsInProject);
        return file?`import ${identifierName}= require(\"${file}\")`: undefined;
    }

    provideFix(info: QuickFixQueryInformation): Refactoring[] {
        var relevantError = info.positionErrors.filter(x=> x.code == 2304)[0];
        var identifier = <ts.Identifier>info.positionNode;

        var identifierName = identifier.text;
        var fileNameforFix = getIdentifierAndFileNames(relevantError, this.getRelativePathsInProject);
        // // Get the type of the stuff on the right if its an assignment
        // var typeString = 'any';
        // var parentOfParent = identifier.parent.parent;
        // if (parentOfParent.kind == ts.SyntaxKind.BinaryExpression
        //     && (<ts.BinaryExpression>parentOfParent).operatorToken.getText().trim() == '=') {
        //
        //     let binaryExpression = <ts.BinaryExpression>parentOfParent;
        //     var type = info.typeChecker.getTypeAtLocation(binaryExpression.right);
        //
        //     /** Discoverd from review of `services.getQuickInfoAtPosition` */
        //     typeString = displayPartsToString(typeToDisplayParts(info.typeChecker, type)).replace(/\s+/g, ' ');
        // }
        //
        // // Find the containing class declaration
        // var memberTarget = ast.getNodeByKindAndName(info.program, ts.SyntaxKind.ClassDeclaration, "errr");
        // // if (!memberTarget) {
        // //     // Find the containing interface declaration
        // //     memberTarget = ast.getNodeByKindAndName(info.program, ts.SyntaxKind.InterfaceDeclaration, className);
        // // }
        // if (!memberTarget) {
        //     return [];
        // }
        //
        // // The following code will be same (and typesafe) for either class or interface
        // let targetDeclaration = <ts.ClassDeclaration|ts.InterfaceDeclaration>memberTarget;
        //
        // // Then the first brace
        // let firstBrace = targetDeclaration.getChildren().filter(x=> x.kind == ts.SyntaxKind.OpenBraceToken)[0];
        //
        // // And the correct indent
        // var indentLength = info.service.getIndentationAtPosition(
        //     info.srcFile.fileName, 0, info.project.projectFile.project.formatCodeOptions);
        var indent = ''; //Array(indentLength + info.project.projectFile.project.formatCodeOptions.IndentSize + 1).join(' ');

        if(fileNameforFix.basename !== identifierName){
            atom.notifications.addError('AtomTS: QuickFix failed, text under cursor does not match filename');
            return [];
        }

        // And add stuff after the first brace
        let refactoring: Refactoring = {
            span: {
                start: 0,
                length: 0
            },
            newText: `${indent }import ${identifierName} = require(\"${fileNameforFix.file}\");${EOL}`,
            filePath:info.srcFile.fileName
        };

        return [refactoring];
    }
}

export default AddImportStatement;
