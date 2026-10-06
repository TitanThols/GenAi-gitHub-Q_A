import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const AGENT_TOOLS: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'searchCode',
            description:
                'Semantically search the indexed codebase for functions, classes, or code related to the query. Use this to find where something is implemented.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description:
                            'A natural language or keyword description, such as "JWT token verification" or "user registration bcrypt".',
                    },
                },
                required: ['query'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'readFile',
            description:
                'Read all indexed code chunks from a specific repository-relative file path.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'The relative file path as shown in searchCode results.',
                    },
                },
                required: ['filePath'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listFiles',
            description: 'List all source files indexed for this repository.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: false,
            },
        },
    },
];
