import { autocompletion } from '@codemirror/autocomplete';
import { linter } from '@codemirror/lint';

// ── Autocomplete Completions ────────────────────────────────────────────────

const cppCompletions = [
  // Headers
  { label: '#include <iostream>', type: 'keyword', detail: 'I/O stream' },
  { label: '#include <vector>', type: 'keyword', detail: 'Dynamic array' },
  { label: '#include <string>', type: 'keyword', detail: 'String class' },
  { label: '#include <algorithm>', type: 'keyword', detail: 'STL algorithms' },
  { label: '#include <map>', type: 'keyword', detail: 'Ordered map' },
  { label: '#include <unordered_map>', type: 'keyword', detail: 'Hash map' },
  { label: '#include <set>', type: 'keyword', detail: 'Ordered set' },
  { label: '#include <queue>', type: 'keyword', detail: 'Queue/Priority queue' },
  { label: '#include <stack>', type: 'keyword', detail: 'Stack' },
  { label: '#include <cmath>', type: 'keyword', detail: 'Math functions' },
  { label: '#include <climits>', type: 'keyword', detail: 'Numeric limits' },
  { label: '#include <bits/stdc++.h>', type: 'keyword', detail: 'All headers (GCC)' },
  // Keywords
  { label: 'using namespace std;', type: 'keyword', detail: 'Standard namespace' },
  { label: 'int main() {\n\t\n\treturn 0;\n}', type: 'function', detail: 'Main function', boost: 2 },
  { label: 'cout', type: 'variable', detail: 'Standard output', apply: 'cout << ' },
  { label: 'cin', type: 'variable', detail: 'Standard input', apply: 'cin >> ' },
  { label: 'endl', type: 'variable', detail: 'End line + flush' },
  { label: 'vector', type: 'class', detail: 'std::vector<T>' },
  { label: 'string', type: 'class', detail: 'std::string' },
  { label: 'pair', type: 'class', detail: 'std::pair<T1,T2>' },
  { label: 'map', type: 'class', detail: 'std::map<K,V>' },
  { label: 'unordered_map', type: 'class', detail: 'std::unordered_map<K,V>' },
  { label: 'set', type: 'class', detail: 'std::set<T>' },
  { label: 'queue', type: 'class', detail: 'std::queue<T>' },
  { label: 'priority_queue', type: 'class', detail: 'std::priority_queue<T>' },
  { label: 'stack', type: 'class', detail: 'std::stack<T>' },
  // Control flow
  { label: 'for', type: 'keyword', apply: 'for (int i = 0; i < n; i++) {\n\t\n}', detail: 'For loop' },
  { label: 'while', type: 'keyword', apply: 'while () {\n\t\n}', detail: 'While loop' },
  { label: 'if', type: 'keyword', apply: 'if () {\n\t\n}', detail: 'If statement' },
  { label: 'else', type: 'keyword' },
  { label: 'switch', type: 'keyword', apply: 'switch () {\n\tcase :\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}', detail: 'Switch statement' },
  { label: 'return', type: 'keyword' },
  { label: 'class', type: 'keyword', apply: 'class ClassName {\npublic:\n\t\n};', detail: 'Class definition' },
  { label: 'struct', type: 'keyword', apply: 'struct StructName {\n\t\n};', detail: 'Struct definition' },
  // STL algorithms
  { label: 'sort', type: 'function', apply: 'sort(.begin(), .end())', detail: 'Sort container' },
  { label: 'reverse', type: 'function', apply: 'reverse(.begin(), .end())', detail: 'Reverse container' },
  { label: 'push_back', type: 'function', detail: 'Add to end' },
  { label: 'pop_back', type: 'function', detail: 'Remove from end' },
  { label: 'size', type: 'function', detail: 'Container size' },
  { label: 'empty', type: 'function', detail: 'Check if empty' },
  { label: 'begin', type: 'function', detail: 'Iterator begin' },
  { label: 'end', type: 'function', detail: 'Iterator end' },
  // Types
  { label: 'int', type: 'type' },
  { label: 'long long', type: 'type' },
  { label: 'double', type: 'type' },
  { label: 'float', type: 'type' },
  { label: 'char', type: 'type' },
  { label: 'bool', type: 'type' },
  { label: 'void', type: 'type' },
  { label: 'auto', type: 'type' },
  { label: 'nullptr', type: 'keyword' },
  { label: 'true', type: 'keyword' },
  { label: 'false', type: 'keyword' },
];

const pythonCompletions = [
  // Built-in functions
  { label: 'print', type: 'function', apply: 'print()', detail: 'Print to stdout' },
  { label: 'input', type: 'function', apply: 'input()', detail: 'Read from stdin' },
  { label: 'len', type: 'function', apply: 'len()', detail: 'Length of object' },
  { label: 'range', type: 'function', apply: 'range()', detail: 'Generate range' },
  { label: 'int', type: 'function', apply: 'int()', detail: 'Convert to integer' },
  { label: 'str', type: 'function', apply: 'str()', detail: 'Convert to string' },
  { label: 'float', type: 'function', apply: 'float()', detail: 'Convert to float' },
  { label: 'list', type: 'function', apply: 'list()', detail: 'Create/convert to list' },
  { label: 'dict', type: 'function', apply: 'dict()', detail: 'Create dictionary' },
  { label: 'set', type: 'function', apply: 'set()', detail: 'Create set' },
  { label: 'tuple', type: 'function', apply: 'tuple()', detail: 'Create tuple' },
  { label: 'sorted', type: 'function', apply: 'sorted()', detail: 'Return sorted list' },
  { label: 'reversed', type: 'function', apply: 'reversed()', detail: 'Reverse iterator' },
  { label: 'enumerate', type: 'function', apply: 'enumerate()', detail: 'Index + value pairs' },
  { label: 'zip', type: 'function', apply: 'zip()', detail: 'Zip iterables' },
  { label: 'map', type: 'function', apply: 'map()', detail: 'Apply function to iterable' },
  { label: 'filter', type: 'function', apply: 'filter()', detail: 'Filter iterable' },
  { label: 'sum', type: 'function', apply: 'sum()', detail: 'Sum of iterable' },
  { label: 'min', type: 'function', apply: 'min()', detail: 'Minimum value' },
  { label: 'max', type: 'function', apply: 'max()', detail: 'Maximum value' },
  { label: 'abs', type: 'function', apply: 'abs()', detail: 'Absolute value' },
  { label: 'type', type: 'function', apply: 'type()', detail: 'Type of object' },
  { label: 'isinstance', type: 'function', apply: 'isinstance()', detail: 'Check instance type' },
  { label: 'open', type: 'function', apply: 'open()', detail: 'Open file' },
  // Keywords
  { label: 'def', type: 'keyword', apply: 'def function_name():\n\t', detail: 'Define function' },
  { label: 'class', type: 'keyword', apply: 'class ClassName:\n\tdef __init__(self):\n\t\t', detail: 'Define class' },
  { label: 'if', type: 'keyword', apply: 'if :\n\t', detail: 'If statement' },
  { label: 'elif', type: 'keyword', apply: 'elif :\n\t', detail: 'Else if' },
  { label: 'else', type: 'keyword', apply: 'else:\n\t', detail: 'Else block' },
  { label: 'for', type: 'keyword', apply: 'for i in :\n\t', detail: 'For loop' },
  { label: 'while', type: 'keyword', apply: 'while :\n\t', detail: 'While loop' },
  { label: 'try', type: 'keyword', apply: 'try:\n\t\nexcept Exception as e:\n\t', detail: 'Try/except block' },
  { label: 'with', type: 'keyword', apply: 'with  as :\n\t', detail: 'Context manager' },
  { label: 'return', type: 'keyword' },
  { label: 'import', type: 'keyword' },
  { label: 'from', type: 'keyword' },
  { label: 'lambda', type: 'keyword', apply: 'lambda x: ', detail: 'Anonymous function' },
  { label: 'True', type: 'keyword' },
  { label: 'False', type: 'keyword' },
  { label: 'None', type: 'keyword' },
  { label: 'and', type: 'keyword' },
  { label: 'or', type: 'keyword' },
  { label: 'not', type: 'keyword' },
  { label: 'in', type: 'keyword' },
  { label: 'is', type: 'keyword' },
  { label: 'pass', type: 'keyword' },
  { label: 'break', type: 'keyword' },
  { label: 'continue', type: 'keyword' },
  { label: 'global', type: 'keyword' },
  // Common methods
  { label: 'append', type: 'method', detail: 'list.append()' },
  { label: 'extend', type: 'method', detail: 'list.extend()' },
  { label: 'insert', type: 'method', detail: 'list.insert()' },
  { label: 'remove', type: 'method', detail: 'list.remove()' },
  { label: 'pop', type: 'method', detail: 'list.pop()' },
  { label: 'split', type: 'method', detail: 'str.split()' },
  { label: 'join', type: 'method', detail: 'str.join()' },
  { label: 'strip', type: 'method', detail: 'str.strip()' },
  { label: 'replace', type: 'method', detail: 'str.replace()' },
  { label: 'format', type: 'method', detail: 'str.format()' },
  { label: 'keys', type: 'method', detail: 'dict.keys()' },
  { label: 'values', type: 'method', detail: 'dict.values()' },
  { label: 'items', type: 'method', detail: 'dict.items()' },
  // Imports
  { label: 'import sys', type: 'keyword', detail: 'System module' },
  { label: 'import os', type: 'keyword', detail: 'OS module' },
  { label: 'import math', type: 'keyword', detail: 'Math module' },
  { label: 'from collections import', type: 'keyword', detail: 'Collections module' },
  { label: 'import itertools', type: 'keyword', detail: 'Itertools module' },
];

const javaCompletions = [
  // Common imports
  { label: 'import java.util.*;', type: 'keyword', detail: 'All util classes' },
  { label: 'import java.util.Scanner;', type: 'keyword', detail: 'Scanner input' },
  { label: 'import java.util.ArrayList;', type: 'keyword', detail: 'ArrayList' },
  { label: 'import java.util.HashMap;', type: 'keyword', detail: 'HashMap' },
  { label: 'import java.util.Arrays;', type: 'keyword', detail: 'Arrays utility' },
  { label: 'import java.io.*;', type: 'keyword', detail: 'IO classes' },
  // Main template
  { label: 'public static void main', type: 'function', apply: 'public static void main(String[] args) {\n\t\n}', detail: 'Main method', boost: 2 },
  // Types
  { label: 'String', type: 'class' },
  { label: 'int', type: 'type' },
  { label: 'long', type: 'type' },
  { label: 'double', type: 'type' },
  { label: 'float', type: 'type' },
  { label: 'boolean', type: 'type' },
  { label: 'char', type: 'type' },
  { label: 'void', type: 'type' },
  // Collections
  { label: 'ArrayList', type: 'class', apply: 'ArrayList<>()', detail: 'Dynamic array' },
  { label: 'HashMap', type: 'class', apply: 'HashMap<>()', detail: 'Hash map' },
  { label: 'HashSet', type: 'class', apply: 'HashSet<>()', detail: 'Hash set' },
  { label: 'LinkedList', type: 'class', apply: 'LinkedList<>()', detail: 'Linked list' },
  { label: 'Queue', type: 'class', detail: 'Queue interface' },
  { label: 'Stack', type: 'class', apply: 'Stack<>()', detail: 'Stack' },
  { label: 'PriorityQueue', type: 'class', apply: 'PriorityQueue<>()', detail: 'Priority queue' },
  // Keywords
  { label: 'public', type: 'keyword' },
  { label: 'private', type: 'keyword' },
  { label: 'protected', type: 'keyword' },
  { label: 'static', type: 'keyword' },
  { label: 'final', type: 'keyword' },
  { label: 'abstract', type: 'keyword' },
  { label: 'class', type: 'keyword' },
  { label: 'interface', type: 'keyword' },
  { label: 'extends', type: 'keyword' },
  { label: 'implements', type: 'keyword' },
  { label: 'new', type: 'keyword' },
  { label: 'this', type: 'keyword' },
  { label: 'super', type: 'keyword' },
  { label: 'return', type: 'keyword' },
  { label: 'null', type: 'keyword' },
  { label: 'true', type: 'keyword' },
  { label: 'false', type: 'keyword' },
  // Control flow
  { label: 'if', type: 'keyword', apply: 'if () {\n\t\n}', detail: 'If statement' },
  { label: 'else', type: 'keyword' },
  { label: 'for', type: 'keyword', apply: 'for (int i = 0; i < n; i++) {\n\t\n}', detail: 'For loop' },
  { label: 'while', type: 'keyword', apply: 'while () {\n\t\n}', detail: 'While loop' },
  { label: 'switch', type: 'keyword', apply: 'switch () {\n\tcase :\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}', detail: 'Switch statement' },
  { label: 'try', type: 'keyword', apply: 'try {\n\t\n} catch (Exception e) {\n\te.printStackTrace();\n}', detail: 'Try/catch block' },
  // Common methods
  { label: 'System.out.println', type: 'function', apply: 'System.out.println()', detail: 'Print line' },
  { label: 'System.out.print', type: 'function', apply: 'System.out.print()', detail: 'Print' },
  { label: 'Scanner', type: 'class', apply: 'Scanner sc = new Scanner(System.in)', detail: 'Create scanner' },
  { label: 'toString', type: 'method' },
  { label: 'equals', type: 'method' },
  { label: 'length', type: 'method' },
  { label: 'size', type: 'method' },
  { label: 'add', type: 'method' },
  { label: 'get', type: 'method' },
  { label: 'put', type: 'method' },
  { label: 'remove', type: 'method' },
  { label: 'contains', type: 'method' },
  { label: 'isEmpty', type: 'method' },
  { label: 'Arrays.sort', type: 'function', apply: 'Arrays.sort()', detail: 'Sort array' },
  { label: 'Collections.sort', type: 'function', apply: 'Collections.sort()', detail: 'Sort list' },
  { label: 'Math.max', type: 'function', apply: 'Math.max()', detail: 'Maximum' },
  { label: 'Math.min', type: 'function', apply: 'Math.min()', detail: 'Minimum' },
  { label: 'Math.abs', type: 'function', apply: 'Math.abs()', detail: 'Absolute value' },
];

function getCompletions(language) {
  switch (language) {
    case 'cpp': return cppCompletions;
    case 'python': return pythonCompletions;
    case 'java': return javaCompletions;
    default: return [];
  }
}

function langAutocomplete(language) {
  return (context) => {
    const word = context.matchBefore(/[\w#<>.]+/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
      from: word.from,
      options: getCompletions(language),
      validFor: /^[\w#<>.]*$/
    };
  };
}

export function getAutocompletionExtension(language) {
  return autocompletion({
    override: [langAutocomplete(language)],
    activateOnTyping: true,
    maxRenderedOptions: 15,
    icons: true
  });
}

// ── Syntax Error Linting ────────────────────────────────────────────────────

function lintCpp(view) {
  const diagnostics = [];
  const doc = view.state.doc;
  const text = doc.toString();
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

    const lineStart = doc.line(i + 1).from;

    // Missing semicolons (basic check)
    if (trimmed.length > 0 &&
        !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
        !trimmed.endsWith(':') && !trimmed.endsWith(',') && !trimmed.endsWith('(') &&
        !trimmed.endsWith(')') && !trimmed.endsWith('\\') &&
        !trimmed.startsWith('#') && !trimmed.startsWith('//') &&
        !trimmed.startsWith('else') && !trimmed.startsWith('public') &&
        !trimmed.startsWith('private') && !trimmed.startsWith('protected') &&
        !trimmed.startsWith('class') && !trimmed.startsWith('struct') &&
        !trimmed.startsWith('template') && !trimmed.startsWith('namespace') &&
        !trimmed.startsWith('using') &&
        !trimmed.includes('main(') && !trimmed.includes('if') && !trimmed.includes('for') &&
        !trimmed.includes('while') && !trimmed.includes('switch') &&
        // Only flag lines that look like statements
        (trimmed.includes('=') || trimmed.includes('cout') || trimmed.includes('cin') ||
         trimmed.includes('return') || trimmed.match(/^\w+\s+\w+\s*\(.*\)\s*$/))
    ) {
      // Skip function definitions
      if (!trimmed.match(/\)\s*$/)) {
        diagnostics.push({
          from: lineStart,
          to: lineStart + line.length,
          severity: 'warning',
          message: 'Possible missing semicolon'
        });
      }
    }

    // Unmatched brackets check
    const opens = (line.match(/\(/g) || []).length;
    const closes = (line.match(/\)/g) || []).length;
    if (opens > closes + 1) {
      diagnostics.push({
        from: lineStart,
        to: lineStart + line.length,
        severity: 'warning',
        message: 'Possible unmatched parenthesis'
      });
    }
  });

  return diagnostics;
}

function lintPython(view) {
  const diagnostics = [];
  const doc = view.state.doc;
  const text = doc.toString();
  const lines = text.split('\n');
  const indentStack = [0];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const lineStart = doc.line(i + 1).from;
    const indent = line.length - line.trimStart().length;

    // Check for tab/space mixing
    if (line.includes('\t') && line.match(/^ /)) {
      diagnostics.push({
        from: lineStart,
        to: lineStart + line.length,
        severity: 'error',
        message: 'Mixed tabs and spaces in indentation'
      });
    }

    // Check for missing colon after def, class, if, for, while, etc.
    if (/^(def |class |if |elif |else|for |while |with |try|except|finally)/.test(trimmed)) {
      if (!trimmed.endsWith(':') && !trimmed.endsWith(':\\') && trimmed !== 'else' && trimmed !== 'try' && trimmed !== 'finally') {
        if (/^(else|try|finally)$/.test(trimmed)) {
          diagnostics.push({
            from: lineStart,
            to: lineStart + line.length,
            severity: 'error',
            message: `Missing colon after '${trimmed}'`
          });
        } else if (!trimmed.endsWith(':')) {
          diagnostics.push({
            from: lineStart,
            to: lineStart + line.length,
            severity: 'warning',
            message: 'Possible missing colon at end of statement'
          });
        }
      }
    }

    // Unmatched brackets
    const opens = (line.match(/\(/g) || []).length;
    const closes = (line.match(/\)/g) || []).length;
    if (opens > closes + 1) {
      diagnostics.push({
        from: lineStart,
        to: lineStart + line.length,
        severity: 'warning',
        message: 'Possible unmatched parenthesis'
      });
    }

    // Common mistakes
    if (trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('!=') &&
        !trimmed.includes('<=') && !trimmed.includes('>=') &&
        (trimmed.startsWith('if ') || trimmed.startsWith('elif ') || trimmed.startsWith('while '))) {
      const beforeColon = trimmed.replace(/:$/, '');
      if (beforeColon.includes('=') && !beforeColon.includes('==')) {
        diagnostics.push({
          from: lineStart,
          to: lineStart + line.length,
          severity: 'warning',
          message: 'Assignment in condition - did you mean == ?'
        });
      }
    }
  });

  return diagnostics;
}

function lintJava(view) {
  const diagnostics = [];
  const doc = view.state.doc;
  const text = doc.toString();
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

    const lineStart = doc.line(i + 1).from;

    // Missing semicolons
    if (trimmed.length > 0 &&
        !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
        !trimmed.endsWith(':') && !trimmed.endsWith(',') && !trimmed.endsWith('(') &&
        !trimmed.endsWith(')') && !trimmed.endsWith('\\') &&
        !trimmed.startsWith('import') && !trimmed.startsWith('package') &&
        !trimmed.startsWith('//') && !trimmed.startsWith('@') &&
        !trimmed.includes('class ') && !trimmed.includes('interface ') &&
        !trimmed.includes('if') && !trimmed.includes('for') &&
        !trimmed.includes('while') && !trimmed.includes('switch') &&
        !trimmed.includes('else') && !trimmed.includes('try') &&
        !trimmed.includes('catch') && !trimmed.includes('finally') &&
        (trimmed.includes('=') || trimmed.includes('System.out') ||
         trimmed.includes('return') || trimmed.match(/\)\s*$/))
    ) {
      if (!trimmed.match(/\)\s*$/) || trimmed.includes('return')) {
        diagnostics.push({
          from: lineStart,
          to: lineStart + line.length,
          severity: 'warning',
          message: 'Possible missing semicolon'
        });
      }
    }

    // Unmatched brackets
    const opens = (line.match(/\(/g) || []).length;
    const closes = (line.match(/\)/g) || []).length;
    if (opens > closes + 1) {
      diagnostics.push({
        from: lineStart,
        to: lineStart + line.length,
        severity: 'warning',
        message: 'Possible unmatched parenthesis'
      });
    }
  });

  return diagnostics;
}

export function getLintExtension(language) {
  let lintFn;
  switch (language) {
    case 'cpp': lintFn = lintCpp; break;
    case 'python': lintFn = lintPython; break;
    case 'java': lintFn = lintJava; break;
    default: return [];
  }
  return linter(lintFn, { delay: 500 });
}
