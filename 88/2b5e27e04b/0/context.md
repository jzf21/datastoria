# Session Context

## User Prompts

### Prompt 1

src/components/query-tab/query-execution/query-executor.tsx (449:11) @ useQueryExecutor


  447 |   const context = useContext(QueryExecutionContext);
  448 |   if (!context) {
> 449 |     throw new Error("useQueryExecutor must be used within a QueryExecutionProvider");
      |           ^
  450 |   }
  451 |   return context;
  452 | }


this error occurs when the chat gives us an exectuable query but when we click on the run button it shows this error

### Prompt 2

Base directory for this skill: /Users/actio/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.1/skills/systematic-debugging

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIR...

### Prompt 3

[Request interrupted by user for tool use]

### Prompt 4

Base directory for this skill: /Users/actio/.claude/plugins/cache/claude-plugins-official/superpowers/4.3.1/skills/requesting-code-review

# Requesting Code Review

Dispatch superpowers:code-reviewer subagent to catch issues before they cascade.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspecti...

### Prompt 5

Fix for "useQueryExecutor must be used within a QueryExecutionProvider" error that occurred when clicking the "run" button on executable SQL queries shown in the chat. make this a commit message

