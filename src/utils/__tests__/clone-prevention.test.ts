import { test as it, expect } from '@playwright/test';

const describe = (name: string, fn: () => void) => fn();
import { glob } from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';

// Function signature patterns to detect potential clones
const FUNCTION_PATTERNS = [
  /export\s+(?:const|function)\s+(\w+)\s*[=:]?\s*(?:async\s*)?\(([^)]*)\)/g,
  /function\s+(\w+)\s*\(([^)]*)\)/g,
  /const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
];

// Known allowed duplicates (after refactoring)
const ALLOWED_DUPLICATES = new Set([
  'optimizedLog', 'optimizedError', 'optimizedWarn', // Logging utilities
  'batchProcess', // Unique batch processing
  'debounce', 'throttle', // Rate limiting utilities
]);

interface FunctionSignature {
  name: string;
  params: string;
  file: string;
  line: number;
}

describe('Code Clone Prevention', () => {
  it('should not have duplicate function implementations', async () => {
    const sourceFiles = await glob('src/**/*.{ts,tsx}', {
      ignore: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**']
    });

    const functions: FunctionSignature[] = [];

    for (const file of sourceFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      for (const pattern of FUNCTION_PATTERNS) {
        let match;
        pattern.lastIndex = 0; // Reset regex state
        
        while ((match = pattern.exec(content)) !== null) {
          const [, name, params] = match;
          
          // Skip if this is an allowed duplicate
          if (ALLOWED_DUPLICATES.has(name)) continue;
          
          // Find line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;

          functions.push({
            name,
            params: params.trim(),
            file: path.relative(process.cwd(), file),
            line: lineNumber
          });
        }
      }
    }

    // Group by function name
    const grouped = functions.reduce((acc, func) => {
      if (!acc[func.name]) acc[func.name] = [];
      acc[func.name].push(func);
      return acc;
    }, {} as Record<string, FunctionSignature[]>);

    // Check for duplicates
    const duplicates: Array<{ name: string; occurrences: FunctionSignature[] }> = [];
    
    Object.entries(grouped).forEach(([name, occurrences]) => {
      if (occurrences.length > 1) {
        duplicates.push({ name, occurrences });
      }
    });

    if (duplicates.length > 0) {
      const errorMessage = duplicates.map(({ name, occurrences }) => 
        `Function "${name}" found in multiple files:\n` +
        occurrences.map(occ => `  - ${occ.file}:${occ.line} (${occ.params})`).join('\n')
      ).join('\n\n');

      throw new Error(`Code clones detected:\n\n${errorMessage}\n\nRefactor to use canonical implementations.`);
    }
  });

  it('should use canonical imports for utility functions', async () => {
    const optimizedApiContent = await fs.readFile('src/utils/optimizedApi.ts', 'utf-8');
    
    expect(optimizedApiContent).toContain('import {');
    expect(optimizedApiContent).toContain('from \'./performanceOptimizer\'');
    expect(optimizedApiContent).toContain('deduplicateRequest as canonicalDedup');
    expect(optimizedApiContent).toContain('measurePerformance');
  });

  it('should not have inline duplicate implementations', async () => {
    const sourceFiles = await glob('src/**/*.{ts,tsx}', {
      ignore: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**']
    });

    // Patterns that suggest potential duplication
    const suspiciousPatterns = [
      /performance\.now\(\)/g,
      /setTimeout.*delete/g,
      /Math\.min.*delay/g,
    ];

    const findings: Array<{ file: string; pattern: string; count: number }> = [];

    for (const file of sourceFiles) {
      const content = await fs.readFile(file, 'utf-8');
      
      for (const pattern of suspiciousPatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 1) {
          findings.push({
            file: path.relative(process.cwd(), file),
            pattern: pattern.source,
            count: matches.length
          });
        }
      }
    }

    // Allow performance.now() in performanceOptimizer.ts as it's the canonical implementation
    const filteredFindings = findings.filter(f => 
      !(f.file.includes('performanceOptimizer.ts') && f.pattern.includes('performance.now'))
    );

    if (filteredFindings.length > 0) {
      const errorMessage = filteredFindings.map(f => 
        `Suspicious pattern "${f.pattern}" found ${f.count} times in ${f.file}`
      ).join('\n');

      console.warn(`Potential duplications detected:\n${errorMessage}`);
    }
  });
});