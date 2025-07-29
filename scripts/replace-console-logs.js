#!/usr/bin/env node

// Script to replace all console.log statements with optimizedLog
// This ensures clean production builds while maintaining dev functionality

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const srcDir = 'src';
const excludeFiles = [
  'src/utils/performanceOptimizer.ts',
  'src/hooks/useErrorMonitoring.tsx'
];

// Files that need console.log replacements
const filesToProcess = [
  'src/components/**/*.tsx',
  'src/components/**/*.ts', 
  'src/hooks/**/*.tsx',
  'src/hooks/**/*.ts',
  'src/pages/**/*.tsx',
  'src/utils/**/*.ts',
  'src/services/**/*.ts'
];

function replaceConsoleLogsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if file already imports optimizedLog
    const hasOptimizedLogImport = content.includes('optimizedLog');
    
    // Count console.log statements
    const consoleLogMatches = content.match(/console\.log\(/g);
    const consoleErrorMatches = content.match(/console\.error\(/g);
    const consoleWarnMatches = content.match(/console\.warn\(/g);
    
    if (!consoleLogMatches && !consoleErrorMatches && !consoleWarnMatches) {
      return false; // No changes needed
    }

    // Add import if needed and there are console statements to replace
    if (!hasOptimizedLogImport && (consoleLogMatches || consoleWarnMatches)) {
      // Find existing imports to insert after them
      const importRegex = /^import\s+.*?from\s+['"`].*?['"`];?$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPoint = lastImportIndex + lastImport.length;
        
        content = content.slice(0, insertPoint) + 
          '\nimport { optimizedLog, optimizedError, optimizedWarn } from \'@/utils/performanceOptimizer\';' +
          content.slice(insertPoint);
        modified = true;
      }
    }

    // Replace console.log with optimizedLog
    if (consoleLogMatches) {
      content = content.replace(/console\.log\(/g, 'optimizedLog(');
      modified = true;
    }

    // Replace console.warn with optimizedWarn
    if (consoleWarnMatches) {
      content = content.replace(/console\.warn\(/g, 'optimizedWarn(');
      modified = true;
    }

    // Replace console.error with optimizedError (but keep console.error for critical errors)
    // We'll be more selective here - only replace debug console.error calls
    const debugErrorPattern = /console\.error\(['"`].*?(?:debug|Debug|DEBUG).*?['"`]/g;
    if (content.match(debugErrorPattern)) {
      content = content.replace(debugErrorPattern, (match) => 
        match.replace('console.error', 'optimizedError')
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath} (${consoleLogMatches?.length || 0} console.log, ${consoleWarnMatches?.length || 0} console.warn replaced)`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  let totalFiles = 0;
  let modifiedFiles = 0;

  filesToProcess.forEach(pattern => {
    const files = glob.sync(pattern, { 
      ignore: excludeFiles,
      absolute: false 
    });

    files.forEach(file => {
      if (!excludeFiles.includes(file)) {
        totalFiles++;
        if (replaceConsoleLogsInFile(file)) {
          modifiedFiles++;
        }
      }
    });
  });

  console.log(`\n🎉 Console.log replacement complete!`);
  console.log(`📊 Files processed: ${totalFiles}`);
  console.log(`✨ Files modified: ${modifiedFiles}`);
  console.log(`🚀 Production builds will now have clean console output`);
}

main();
