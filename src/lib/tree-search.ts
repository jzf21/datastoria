/**
 * Tree Search Algorithm
 *
 * This module implements a position-based tree search algorithm that supports:
 * - Exact path matching for non-terminal segments
 * - Fuzzy (substring) matching for the last segment
 * - Trailing dot expansion (empty last segment expands matched parent)
 *
 * ## Algorithm Overview
 *
 * The search query is split by a separator (default: ".") into segments.
 * Only leading empty strings are filtered out; trailing empty strings are preserved
 * to indicate trailing dot expansion.
 *
 * ### Segment Splitting Examples:
 * - "text" → ["text"]
 * - "system.pos" → ["system", "pos"]
 * - "system.pos." → ["system", "pos", ""] (trailing empty indicates expansion)
 *
 * ### Search Process:
 *
 * The `searchNodes` function processes nodes recursively with a position parameter
 * indicating which segment to match:
 *
 * 1. **Non-terminal segments** (position < length - 1):
 *    - Require exact match (case-insensitive)
 *    - If current node matches exactly, recurse to children with position + 1
 *    - Example: For "system.metric", position 0 requires exact match of "system"
 *
 * 2. **Last segment** (position === length - 1):
 *    - If empty string: Expand matched parent node (show all children)
 *      - Example: "system." → matches "system" exactly, then expands to show all children
 *    - If not empty: Perform fuzzy (substring) search on current node and children
 *      - Example: "system.metric" → matches "system" exactly, then fuzzy matches "metric" in children
 *
 * ### Examples:
 *
 * **Example 1: "system"**
 * - Segments: ["system"]
 * - Position 0: Last segment, not empty → fuzzy search for "system"
 * - Result: Matches any node containing "system" as substring
 *
 * **Example 2: "system.pos"**
 * - Segments: ["system", "pos"]
 * - Position 0: Exact match "system" → recurse with position 1
 * - Position 1: Last segment, not empty → fuzzy search for "pos" in children
 * - Result: Matches "system" exactly, then fuzzy matches "pos" in its children
 *
 * **Example 3: "system.pos."**
 * - Segments: ["system", "pos", ""]
 * - Position 0: Exact match "system" → recurse with position 1
 * - Position 1: Exact match "pos" → recurse with position 2
 * - Position 2: Last segment is empty → expand matched parent
 * - Result: Matches "system" and "pos" exactly, then expands to show all children of "pos"
 *
 * **Example 4: "system.metric"**
 * - Segments: ["system", "metric"]
 * - Position 0: Exact match "system" → recurse with position 1
 * - Position 1: Last segment, not empty → fuzzy search for "metric" in children
 * - Result: Matches "system" exactly, then fuzzy matches "metric" in "metric_log" and "metrics"
 */

import type { TreeDataItem } from "@/components/ui/tree";
import React from "react";
import { TextHighlighter } from "../lib/text-highlighter";

interface SearchContext {
  /**
   * The segments of the search query.
   * For example, if the search query is "system.query_log", the segments are ["system", "query_log"].
   */
  segments: string[];
  hasTrailingDot: boolean;
  highlight: (text: string, start: number, end: number) => React.ReactNode;
  /**
   * Function to perform substring matching (case-insensitive).
   * Returns match information including start and end indices.
   */
  match: (node: TreeDataItem, pattern: string) => { matches: boolean; start: number; end: number };
}

function searchNodes(
  node: TreeDataItem,
  context: SearchContext,
  position: number = 0,
  currentPath: string[] = []
): TreeDataItem | null {
  const { segments, highlight } = context;
  const isFolderNode = node.type ? node.type === "folder" : node.children !== undefined && node.children.length > 0;
  const displayText = String(node.displayText || node.text);

  // Check if we're at the last segment
  const isLastSegment = position === segments.length - 1;
  const currentSegment = segments[position];

  let matches = false;
  let highlightedText: React.ReactNode = displayText;

  // Non-terminal segment: require exact match
  if (!isLastSegment) {
    // Check if current node matches the segment exactly (case-insensitive)
    const exactMatch = displayText.toLowerCase() === currentSegment.toLowerCase();

    if (exactMatch) {
      matches = true;
      highlightedText = highlight(displayText, 0, displayText.length);

      // Check if next segment is empty (trailing dot case)
      const nextSegment = segments[position + 1];
      const isNextSegmentEmpty = nextSegment === "";

      if (isNextSegmentEmpty) {
        // Trailing dot: show all children without processing them
        // Only the current node should be highlighted and expanded
        if (node.children) {
          const unprocessedChildren = node.children.map((child) => ({
            ...child,
            displayText: child.text, // Always use original text, never highlighted displayText
            _expanded: false, // Children should not be expanded
          }));

          return {
            ...node,
            displayText: highlightedText,
            children: unprocessedChildren,
            _expanded: true, // Only the matched parent is expanded
          };
        }

        return {
          ...node,
          displayText: highlightedText,
          children: node.children ? [] : undefined,
          _expanded: true,
        };
      }

      // Recurse to children with next position
      const children: TreeDataItem[] = [];
      if (node.children) {
        const childCurrentPath = [...currentPath, displayText];
        for (const child of node.children) {
          const childResult = searchNodes(child, context, position + 1, childCurrentPath);
          if (childResult) {
            children.push(childResult);
          }
        }
      }

      // Include node if it matches or has matching children
      if (children.length > 0) {
        return {
          ...node,
          displayText: highlightedText,
          children,
          _expanded: true, // Expand nodes that match non-terminal segments
        };
      }

      // Node matches but has no matching children - still include it
      return {
        ...node,
        displayText: highlightedText,
        children: node.children ? [] : undefined,
      };
    }

    // Current node doesn't match - check children
    const children: TreeDataItem[] = [];
    if (node.children) {
      const childCurrentPath = [...currentPath, displayText];
      for (const child of node.children) {
        const childResult = searchNodes(child, context, position, childCurrentPath);
        if (childResult) {
          children.push(childResult);
        }
      }
    }

    // Include node if it has matching children
    if (children.length > 0) {
      return {
        ...node,
        children,
        _expanded: true,
      };
    }

    return null;
  }

  // Last segment: handle fuzzy search or expansion
  const isLastSegmentEmpty = currentSegment === "";

  if (isLastSegmentEmpty) {
    // Trailing dot: expand matched parent node (show all children)
    // The parent should have matched all previous segments exactly
    // Only the matched parent should be highlighted and expanded
    // Children should be shown but NOT highlighted or expanded
    if (isFolderNode && node.children) {
      matches = true;
      highlightedText = highlight(displayText, 0, displayText.length);

      // Include all children without searching them, ensuring they are not highlighted or expanded
      // Always use the original text property, never displayText (which might be highlighted)
      const unprocessedChildren = node.children.map((child) => ({
        ...child,
        displayText: child.text, // Always use original text, never highlighted displayText
        _expanded: false, // Children should not be expanded
      }));

      return {
        ...node,
        displayText: highlightedText,
        children: unprocessedChildren,
        _expanded: true, // Only the matched parent is expanded
      };
    }

    // For leaf nodes with trailing dot, check if parent path matches
    return {
      ...node,
      _expanded: false,
    };
  }

  // Last segment is not empty: perform fuzzy (substring) search
  const fuzzyMatch = context.match(node, currentSegment);

  if (fuzzyMatch.matches) {
    matches = true;
    highlightedText = highlight(displayText, fuzzyMatch.start, fuzzyMatch.end);
  }

  // Process children for fuzzy matching
  const children: TreeDataItem[] = [];
  if (node.children) {
    const childCurrentPath = [...currentPath, displayText];
    for (const child of node.children) {
      // For last segment, also search children with the same position (fuzzy search)
      const childResult = searchNodes(child, context, position, childCurrentPath);
      if (childResult) {
        children.push(childResult);
      }
    }
  }

  // Additional highlighting: if node doesn't match but has matching children,
  // check if it's a complete word match (to highlight parent nodes in path)
  if (!matches && isFolderNode && children.length > 0) {
    const completeMatch = context.match(node, currentSegment);
    if (completeMatch.matches && completeMatch.start === 0 && completeMatch.end === displayText.length) {
      matches = true;
      highlightedText = highlight(displayText, completeMatch.start, completeMatch.end);
    }
  }

  // Include node if it matches or has matching children
  if (matches || children.length > 0) {
    // Determine expansion: expand if node matches or has matching children
    const shouldExpand = matches || children.length > 0;

    return {
      ...node,
      _expanded: shouldExpand,
      displayText: matches ? highlightedText : node.displayText,
      children: children.length > 0 ? children : node.children ? [] : undefined,
    };
  }

  return null;
}

// Search nodes but skip matching nodes above the start level
// This ensures parent nodes (above startLevel) are included for structure but not matched/highlighted
function searchTreeFromGivenLevel(
  nodes: TreeDataItem[],
  context: SearchContext,
  startLevel: number,
  currentLevel: number = 0
): TreeDataItem[] {
  // If we're above the start level, don't search nodes at this level
  // Just include them if they have matching children at deeper levels
  if (currentLevel < startLevel) {
    const result: TreeDataItem[] = [];
    for (const node of nodes) {
      if (node.children) {
        const matchedChildren = searchTreeFromGivenLevel(node.children, context, startLevel, currentLevel + 1);
        if (matchedChildren.length > 0) {
          // Although we search from given level, we only show parent nodes when there's match
          // So that we can show some text to indicate no match found
          result.push({
            ...node,
            children: matchedChildren,
          });
        }
      }
    }
    return result;
  }

  // We're at or below the start level - search all nodes normally
  const result: TreeDataItem[] = [];
  for (const node of nodes) {
    const nodeResult = searchNodes(node, context, 0, []);
    if (nodeResult) {
      result.push(nodeResult);
    }
  }
  return result;
}

// Search tree nodes by given input following the PRD rules.
export function searchTree(
  tree: TreeDataItem[] | undefined,
  search: string,
  options?: {
    pathSeparator?: string;
    highlighter?: (text: string, start: number, end: number) => React.ReactNode;
    startLevel?: number; // Level to start searching from (0 = root, 1 = children of root, etc.)
    match?: (node: TreeDataItem, pattern: string) => { matches: boolean; start: number; end: number };
  }
): TreeDataItem[] {
  if (search === "") {
    return tree ?? [];
  }
  if (tree === undefined) {
    return [];
  }

  // Parse input segments: only skip leading empty strings, preserve trailing empty for expansion
  const pathSeparator = options?.pathSeparator ?? ".";
  const startLevel = options?.startLevel ?? 0;
  const highlight =
    options?.highlighter ??
    ((text: string, start: number, end: number) => TextHighlighter.highlight2(text, start, end, "text-yellow-500"));

  // Default substringMatch implementation (case-sensitive)
  const substringMatch =
    options?.match ??
    ((node: TreeDataItem, pattern: string) => {
      const index = node.search.indexOf(pattern);

      return {
        matches: index >= 0,
        start: index,
        end: index + pattern.length,
      };
    });

  // Split by separator and only filter leading empty strings
  const rawSegments = search.split(pathSeparator);
  const segments: string[] = [];
  let foundNonEmpty = false;
  for (const segment of rawSegments) {
    if (segment.trim() !== "") {
      foundNonEmpty = true;
      segments.push(segment);
    } else if (foundNonEmpty) {
      // Only preserve trailing empty strings (after we've seen non-empty)
      segments.push("");
    }
    // Skip leading empty strings (before we've seen non-empty)
  }

  const hasTrailingDot = search.endsWith(pathSeparator);

  if (segments.length === 0) {
    return tree;
  }

  const context: SearchContext = {
    segments,
    hasTrailingDot,
    highlight,
    match: substringMatch,
  };

  // Use searchTreeFromGivenLevel for all cases - it handles startLevel === 0 correctly
  // (when currentLevel < startLevel is false, it searches normally)
  return searchTreeFromGivenLevel(tree, context, startLevel);
}
