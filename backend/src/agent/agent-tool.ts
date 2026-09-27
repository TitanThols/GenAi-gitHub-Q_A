import { FunctionDeclaration, Type } from '@google/genai';

export const searchCodeTool: FunctionDeclaration = {
    name: 'searchCode',
    description:
        'Semantically search the indexed codebase for functions, classes, or code ' +
        'related to the query. Use this to find WHERE something is implemented.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description:
                    'A natural language or keyword description of what you are looking for. ' +
                    'E.g. "JWT token verification", "user registration bcrypt".',
            },
        },
        required: ['query'],
    },
};

export const readFileTool: FunctionDeclaration = {
    name: 'readFile',
    description:
        'Read all indexed code chunks from a specific file path in the repository. ' +
        'Use this to inspect an entire file after finding it via searchCode.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            filePath: {
                type: Type.STRING,
                description:
                    'The relative file path exactly as it appears in searchCode results. ' +
                    'E.g. "lib/index.js", "src/auth/auth.service.ts".',
            },
        },
        required: ['filePath'],
    },
};

export const listFilesTool: FunctionDeclaration = {
    name: 'listFiles',
    description:
        'List all source files that have been indexed in this repository. ' +
        'Use this to understand the project structure and find relevant file paths.',
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
    },
};

export const AGENT_TOOLS = [searchCodeTool, readFileTool, listFilesTool];
