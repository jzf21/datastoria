# AI Chat Feature Implementation Guide

This document explains the implementation of the AI chat feature for ClickHouse Console, with a focus on the tool-calling architecture.

## Architecture Overview

The chat feature uses a split client-server architecture:
- **Backend**: A Next.js API Route (`/api/chat`) acts as a secure proxy to the configured LLM provider (e.g., OpenAI, Google, Anthropic).
- **Frontend**: The client-side application uses the `@ai-sdk/react` library to manage chat state, handle user input, and render the conversation.
- **Tool Execution**: All tools are executed **client-side** (in the browser). This allows them to directly access the user's current ClickHouse connection context without needing to pass credentials or session information to the backend.

### High-Level Data Flow

```mermaid
sequenceDiagram
    participant Client (Browser)
    participant Server (Next.js API)
    participant LLM (OpenAI, etc.)
    participant ClickHouse

    Client->>+Server: POST /api/chat with message history
    Server->>+LLM: Forward conversation
    LLM-->>-Server: Stream response (Tool Call Request)
    Server-->>-Client: Stream response (Tool Call Request)
    Client->>Client: onToolCall() triggered
    Client->>+ClickHouse: Execute SQL query
    ClickHouse-->>-Client: Query results
    Client->>+Server: POST /api/chat with tool results
    Server->>+LLM: Forward conversation with tool results
    LLM-->>-Server: Stream final text response
    Server-->>-Client: Stream final text response
```

---

## Core Components and Responsibilities

| File Path                                                   | Responsibility                                                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/chat/route.ts`                                     | **Server API Endpoint**. Receives requests, builds the system prompt, calls the LLM, and streams the response back. It is stateless and acts as a proxy.               |
| `src/lib/chat/create-chat.ts`                               | **Client-Side Chat Factory**. Creates and configures the `Chat` instance used by the UI. This is where the crucial `onToolCall` handler is defined.                     |
| `src/components/query-tab/chat-list-item-view.tsx`          | **React UI Component**. Uses the `useChat({ chat })` hook to bind the UI to the configured `Chat` instance and handles sending user messages.                                 |
| `src/lib/ai/ai-tools.ts`                                    | **Tool Registry**. Defines the schemas (inputs/outputs) for all available tools and provides the `toolExecutors` map, which contains the client-side execution logic. |

---

## Detailed Tool Call Flow

This is a step-by-step breakdown of how a tool call is executed from user input to the final answer.

1.  **User Input**: The user sends a message that requires database access, e.g., "how many tables are in the default database?".

2.  **Client to Server**: The `useChat` hook in `chat-list-item-view.tsx` sends the entire message history to the `/api/chat` endpoint.

3.  **Server to LLM**: `route.ts` receives the request. It constructs a system prompt containing the available tool definitions and forwards the full conversation to the configured LLM (e.g., OpenAI).

4.  **LLM Response (Tool Call)**: The LLM analyzes the request and determines that it needs to call the `get_tables` tool. Instead of returning text, it returns a structured tool call request in its response.

5.  **Server to Client (Streaming)**: The `route.ts` endpoint streams the LLM's response back to the browser. This stream contains special message parts indicating that a tool needs to be called.

6.  **Client-Side Tool Execution**:
    - The AI SDK processes the incoming stream.
    - It detects the tool call request and triggers the `onToolCall` handler defined in `src/lib/chat/create-chat.ts`.
    - The handler looks up the `get_tables` function in the `toolExecutors` registry from `ai-tools.ts`.
    - The `get_tables` function is executed **in the browser**. It uses the application's existing `ConnectionManager` to get the active ClickHouse connection and executes the required `SELECT * FROM system.tables` query.

7.  **Client to Server (Tool Result)**:
    - Once the query completes, the tool returns the list of tables.
    - The `onToolCall` handler calls `chat.addToolResult(...)` to add the result to the chat state.
    - The `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` configuration in `create-chat.ts` detects that the tool call is complete and automatically sends a **new** request to `/api/chat`. This request includes the original conversation *plus* the new tool result.

8.  **Server to LLM (with Result)**: The server receives this updated message history and forwards it back to the LLM. The LLM now has the context of the original question and the data it requested.

9.  **Final Response**: The LLM uses the table data to formulate a natural language answer (e.g., "There are 25 tables in the default database."). This final text response is streamed back to the client and displayed to the user.

---

## Critical Implementation Details & "Gotchas"

This section documents key technical challenges discovered during development and their solutions. It is a critical reference for future troubleshooting.

### 1. Server-Side Streaming Logic

*   **Problem**: Early implementations used a manual `for await...of` loop to read the stream from the AI SDK and pipe it to the client. This failed because tool calls create complex, multi-part streams. The loop would interpret the end of the first part (e.g., the start of a tool call) as the end of the entire stream, prematurely closing the connection and causing a `Controller is already closed` error on the server and a `TypeError: Cannot read properties of undefined (reading 'startsWith')` error on the client.
*   **Solution**: The manual loop was replaced with a robust piping mechanism using `TransformStream`. This is the correct, modern way to handle web streams and ensures the entire, complex response from the AI SDK is correctly piped to the browser without being prematurely terminated.

```typescript
    // app/api/chat/route.ts
    const sseStream = stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          const data = JSON.stringify(chunk)
          controller.enqueue(`data: ${data}\n\n`);
        },
      })
    ).pipeThrough(new TextEncoderStream());

    return new Response(sseStream, { ... });
    ```

### 2. `useChat` Hook Configuration

*   **Problem**: The application was correctly creating a `Chat` instance with an `onToolCall` handler, but the `useChat` hook was being initialized with `useChat({ api: '/api/chat' })`. This causes the hook to create its own **new, unconfigured** chat instance internally, ignoring the one with the tool handler. As a result, tool calls from the server were received but never acted upon.
*   **Solution**: The `useChat` hook **must** be initialized by passing the pre-configured `Chat` instance. This ensures the hook uses the instance that contains all our custom logic, including the critical `onToolCall` handler.

```typescript
    // src/components/query-tab/chat-list-item-view.tsx
    const { messages, error } = useChat({
      chat: chat, // Correct: Pass the configured instance
    });
    ```

### 3. Backend Message Processing

*   **Problem**: To handle different message formats, the backend initially included logic to manually iterate through the `messages` array from the client and process each `part`. This failed when the client sent back tool results, because the AI SDK includes internal-use-only parts like `{ type: 'step-start' }`. The manual parsing logic didn't recognize this type and crashed with an `Unknown part type: step-start` error.
*   **Solution**: The server **must not** attempt to manually parse or validate the internal structure of the `messages` array it receives from the client. The array should be treated as an opaque object and passed directly to the `streamText` function. The AI SDK is responsible for understanding its own data structures.

```typescript
    // app/api/chat/route.ts
    const body = await req.json();
    const messages = body.messages; // Use the array directly

    const result = streamText({
      model,
      messages: [ // Pass it directly to the SDK
        { role: 'system', content: systemPrompt },
        ...convertToModelMessages(messages),
      ],
      tools,
    });
    ```

---

## Future Enhancements

- [ ] IndexedDB migration for better performance and larger storage
- [ ] Server-side chat history persistence for multi-device sync
- [ ] Chat management UI (list, delete, rename)
- [ ] Enhanced error recovery and retry logic for tool calls

