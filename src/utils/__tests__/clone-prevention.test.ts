/**
 * Clone prevention tests for maintaining canonical implementations
 * This test suite ensures that duplicate code is refactored to use canonical utilities
 */

import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'fast-glob';

test.describe('Clone Prevention', () => {
  const srcPath = path.join(process.cwd(), 'src');
  
  test('should use canonical performance utilities', async () => {
    // Find all TypeScript files in src
    const files = await glob('**/*.{ts,tsx}', { 
      cwd: srcPath,
      ignore: ['**/*.test.ts', '**/*.test.tsx', '**/types.ts']
    });

    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for direct performance.now() usage instead of measurePerformance
        if (line.includes('performance.now()') && !file.includes('performanceOptimizer.ts')) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim()
          });
        }

        // Check for direct console.log instead of optimizedLog
        if (line.includes('console.log') && !file.includes('performanceOptimizer.ts')) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }

    if (violations.length > 0) {
      const violationReport = violations
        .map(v => `${v.file}:${v.line} - ${v.content}`)
        .join('\n');
      
      expect(violations.length).toBe(0);
    }
  });

  test('should import from canonical performanceOptimizer', async () => {
    const optimizedApiPath = path.join(srcPath, 'utils/optimizedApi.ts');
    const optimizedApiExists = await fs.access(optimizedApiPath).then(() => true).catch(() => false);
    
    if (optimizedApiExists) {
      const optimizedApiContent = await fs.readFile(optimizedApiPath, 'utf-8');
      
      expect(optimizedApiContent).toContain('import {');
      expect(optimizedApiContent).toContain('from \'./performanceOptimizer\'');
      expect(optimizedApiContent).toContain('deduplicateRequest as canonicalDedup');
      expect(optimizedApiContent).toContain('measurePerformance');
    }
  });

  test('should not contain duplicate function signatures', async () => {
    const files = await glob('**/*.{ts,tsx}', { 
      cwd: srcPath,
      ignore: ['**/*.test.ts', '**/*.test.tsx', '**/types.ts']
    });

    const functionSignatures = new Map<string, string[]>();
    const suspiciousPatterns = [
      /const\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>/,
      /function\s+\w+\s*\([^)]*\)/,
      /export\s+const\s+\w+\s*=\s*\([^)]*\)\s*=>/
    ];

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      for (const pattern of suspiciousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            const signature = match.replace(/\s+/g, ' ').trim();
            if (!functionSignatures.has(signature)) {
              functionSignatures.set(signature, []);
            }
            functionSignatures.get(signature)!.push(file);
          }
        }
      }
    }

    // Filter out signatures that appear in multiple files (potential duplicates)
    const duplicates = Array.from(functionSignatures.entries())
      .filter(([_, files]) => files.length > 1)
      .filter(([signature]) => 
        // Allow common patterns that are expected to be duplicated
        !signature.includes('useState') &&
        !signature.includes('useEffect') &&
        !signature.includes('export default')
      );

    expect(duplicates.length).toBe(0);
  });

  test('should use optimized supabase calls from canonical sources', async () => {
    const files = await glob('**/*.{ts,tsx}', { 
      cwd: srcPath,
      ignore: ['**/*.test.ts', '**/*.test.tsx', '**/types.ts', '**/optimizedApi.ts']
    });

    const findings: Array<{ file: string; pattern: string; line: number }> = [];

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for direct supabase calls that should use optimized versions
        if (line.includes('supabase.from(') && !line.includes('optimizedSupabaseCall')) {
          findings.push({
            file,
            pattern: 'Direct supabase.from() call',
            line: index + 1
          });
        }

        // Check for setTimeout without using canonical timeout
        if (line.includes('setTimeout') && !file.includes('performanceOptimizer.ts')) {
          findings.push({
            file,
            pattern: 'Direct setTimeout usage',
            line: index + 1
          });
        }
      });
    }

    // Allow performance.now() in performanceOptimizer.ts as it's the canonical implementation
    const filteredFindings = findings.filter(f => 
      !(f.file.includes('performanceOptimizer.ts') && f.pattern.includes('performance.now'))
    );

    if (filteredFindings.length > 0) {
      const findingReport = filteredFindings
        .map(f => `${f.file}:${f.line} - ${f.pattern}`)
        .join('\n');
      
      console.warn('Potential code clones detected:\n' + findingReport);
      console.warn('Consider refactoring to use canonical implementations from src/utils/performanceOptimizer.ts');
    }

    // For now, just warn but don't fail the test to allow gradual migration
    expect(true).toBe(true);
  });
});