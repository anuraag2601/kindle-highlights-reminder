// Production Build System - Milestone 5
// Creates optimized builds for Chrome Web Store submission

const fs = require('fs').promises;
const path = require('path');

class ProductionBuilder {
  constructor() {
    this.sourceDir = __dirname;
    this.buildDir = path.join(__dirname, 'dist');
    this.excludePatterns = [
      'node_modules',
      'dist',
      '.git',
      '*.test.js',
      'tests',
      'coverage',
      'build.js',
      'README.md',
      'package.json',
      'package-lock.json',
      '.gitignore',
      'diagnostic.html',
      'DEBUG_SYNC.md'
    ];
  }

  async build() {
    console.log('🚀 Starting production build...');
    
    try {
      // Clean build directory
      await this.cleanBuildDir();
      
      // Copy source files
      await this.copySourceFiles();
      
      // Optimize manifest for production
      await this.optimizeManifest();
      
      // Minify CSS files
      await this.minifyCSS();
      
      // Optimize JavaScript (basic)
      await this.optimizeJavaScript();
      
      // Validate build
      await this.validateBuild();
      
      // Generate build report
      await this.generateBuildReport();
      
      console.log('✅ Production build completed successfully!');
      console.log(`📁 Build output: ${this.buildDir}`);
      
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  }

  async cleanBuildDir() {
    console.log('🧹 Cleaning build directory...');
    
    try {
      await fs.rmdir(this.buildDir, { recursive: true });
    } catch (error) {
      // Directory might not exist, that's okay
    }
    
    await fs.mkdir(this.buildDir, { recursive: true });
  }

  async copySourceFiles() {
    console.log('📋 Copying source files...');
    
    const filesToCopy = await this.getSourceFiles();
    
    for (const file of filesToCopy) {
      const sourcePath = path.join(this.sourceDir, file);
      const destPath = path.join(this.buildDir, file);
      
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Copy file
      await fs.copyFile(sourcePath, destPath);
    }
    
    console.log(`📁 Copied ${filesToCopy.length} files`);
  }

  async getSourceFiles() {
    const files = [];
    
    async function walkDir(dir, baseDir = '') {
      const items = await fs.readdir(path.join(__dirname, dir));
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(baseDir, item);
        const stat = await fs.stat(path.join(__dirname, fullPath));
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          if (!this.shouldExclude(relativePath)) {
            await walkDir.call(this, fullPath, relativePath);
          }
        } else {
          // Include file if not excluded
          if (!this.shouldExclude(relativePath)) {
            files.push(relativePath);
          }
        }
      }
    }
    
    await walkDir.call(this, '.');
    return files;
  }

  shouldExclude(filePath) {
    return this.excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }

  async optimizeManifest() {
    console.log('📝 Optimizing manifest...');
    
    const manifestPath = path.join(this.buildDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    
    // Update version for production
    const now = new Date();
    const buildVersion = `${manifest.version}.${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    
    // Production optimizations
    const productionManifest = {
      ...manifest,
      version: buildVersion,
      // Remove development-only permissions if any
      // Add production-ready descriptions
      description: manifest.description || "Extract Kindle highlights and receive daily email reminders for spaced repetition learning",
      // Ensure all required fields are present
      author: manifest.author || "Kindle Highlights Reminder Team"
    };

    await fs.writeFile(manifestPath, JSON.stringify(productionManifest, null, 2));
    console.log(`📦 Updated manifest version to: ${buildVersion}`);
  }

  async minifyCSS() {
    console.log('🎨 Minifying CSS files...');
    
    const cssFiles = [
      'popup/popup.css',
      'options/options.css',
      'onboarding/welcome.css'
    ];

    for (const cssFile of cssFiles) {
      const filePath = path.join(this.buildDir, cssFile);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const minified = this.minifyCSSSImple(content);
        await fs.writeFile(filePath, minified);
        console.log(`  ✅ Minified ${cssFile}`);
      } catch (error) {
        console.warn(`  ⚠️ Could not minify ${cssFile}:`, error.message);
      }
    }
  }

  minifyCSSSImple(css) {
    return css
      // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove whitespace around special characters
      .replace(/\s*([{}:;,>+~])\s*/g, '$1')
      // Remove trailing semicolons
      .replace(/;}/g, '}')
      // Remove whitespace at start/end
      .trim();
  }

  async optimizeJavaScript() {
    console.log('⚡ Optimizing JavaScript files...');
    
    const jsFiles = [
      'popup/popup.js',
      'options/options.js',
      'onboarding/welcome.js',
      'background.js'
    ];

    for (const jsFile of jsFiles) {
      const filePath = path.join(this.buildDir, jsFile);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const optimized = this.optimizeJavaScriptSimple(content);
        await fs.writeFile(filePath, optimized);
        console.log(`  ✅ Optimized ${jsFile}`);
      } catch (error) {
        console.warn(`  ⚠️ Could not optimize ${jsFile}:`, error.message);
      }
    }
  }

  optimizeJavaScriptSimple(js) {
    return js
      // Remove single-line comments (but preserve URLs)
      .replace(/\/\/(?![/:]).*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove excessive whitespace
      .replace(/\n\s*\n/g, '\n')
      // Remove leading/trailing whitespace from lines
      .split('\n').map(line => line.trim()).join('\n')
      // Remove empty lines
      .replace(/\n\n+/g, '\n')
      .trim();
  }

  async validateBuild() {
    console.log('🔍 Validating build...');
    
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'popup/popup.html',
      'popup/popup.js',
      'popup/popup.css',
      'options/options.html',
      'options/options.js',
      'options/options.css',
      'icons/icon-16.png',
      'icons/icon-48.png',
      'icons/icon-128.png'
    ];

    const errors = [];
    
    for (const file of requiredFiles) {
      try {
        await fs.stat(path.join(this.buildDir, file));
        console.log(`  ✅ ${file}`);
      } catch (error) {
        errors.push(`Missing required file: ${file}`);
        console.log(`  ❌ ${file}`);
      }
    }

    // Validate manifest
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(this.buildDir, 'manifest.json'), 'utf8'));
      
      if (!manifest.name) errors.push('Manifest missing name');
      if (!manifest.version) errors.push('Manifest missing version');
      if (!manifest.description) errors.push('Manifest missing description');
      if (manifest.manifest_version !== 3) errors.push('Manifest must use version 3');
      
      console.log(`  ✅ Manifest validation passed`);
    } catch (error) {
      errors.push(`Manifest validation failed: ${error.message}`);
    }

    if (errors.length > 0) {
      throw new Error(`Build validation failed:\n${errors.join('\n')}`);
    }
    
    console.log('✅ Build validation passed');
  }

  async generateBuildReport() {
    console.log('📊 Generating build report...');
    
    const buildStats = await this.getBuildStats();
    const report = {
      buildTime: new Date().toISOString(),
      totalFiles: buildStats.fileCount,
      totalSize: buildStats.totalSize,
      sizeByType: buildStats.sizeByType,
      version: buildStats.version,
      errors: buildStats.errors || [],
      warnings: buildStats.warnings || []
    };

    const reportPath = path.join(this.buildDir, 'build-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('📋 Build Report:');
    console.log(`  📁 Total files: ${report.totalFiles}`);
    console.log(`  📏 Total size: ${this.formatBytes(report.totalSize)}`);
    console.log(`  📦 Version: ${report.version}`);
    
    // Show size breakdown
    for (const [type, size] of Object.entries(report.sizeByType)) {
      console.log(`  ${type}: ${this.formatBytes(size)}`);
    }
  }

  async getBuildStats() {
    const stats = {
      fileCount: 0,
      totalSize: 0,
      sizeByType: {},
      version: null,
      errors: [],
      warnings: []
    };

    async function walkBuildDir(dir) {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          await walkBuildDir(fullPath);
        } else {
          stats.fileCount++;
          stats.totalSize += stat.size;
          
          const ext = path.extname(item).toLowerCase();
          const type = ext || 'other';
          stats.sizeByType[type] = (stats.sizeByType[type] || 0) + stat.size;
        }
      }
    }

    await walkBuildDir(this.buildDir);

    // Get version from manifest
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(this.buildDir, 'manifest.json'), 'utf8'));
      stats.version = manifest.version;
    } catch (error) {
      stats.errors.push(`Could not read version: ${error.message}`);
    }

    return stats;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Chrome Web Store preparation
class WebStorePrep {
  constructor(buildDir) {
    this.buildDir = buildDir;
  }

  async createSubmissionPackage() {
    console.log('📦 Creating Chrome Web Store submission package...');
    
    const zipPath = path.join(path.dirname(this.buildDir), 'kindle-highlights-reminder.zip');
    
    // Note: In a real build system, you'd use a proper zip library
    // For now, we'll just provide instructions
    
    const instructions = `
Chrome Web Store Submission Checklist:

1. Create ZIP file:
   - Compress the entire 'dist' folder contents
   - Do NOT include the 'dist' folder itself, just its contents
   - Name it: kindle-highlights-reminder.zip

2. Required for Chrome Web Store:
   ✅ manifest.json (version 3)
   ✅ Icons (16x16, 48x48, 128x128)
   ✅ Extension description
   ✅ Privacy policy (if collecting data)
   ✅ Screenshots for store listing

3. Store Listing Requirements:
   - Extension name: "Kindle Highlights Reminder"
   - Category: Productivity
   - Description: "Transform your Kindle highlights into a powerful learning system with spaced repetition email reminders"
   - Screenshots: Include popup, options page, email examples
   - Privacy policy: Required for email functionality

4. Upload Process:
   - Go to Chrome Web Store Developer Console
   - Upload ZIP file
   - Fill out store listing
   - Submit for review

Build package ready at: ${this.buildDir}
`;

    const instructionsPath = path.join(path.dirname(this.buildDir), 'SUBMISSION_INSTRUCTIONS.txt');
    await fs.writeFile(instructionsPath, instructions);
    
    console.log('📋 Submission instructions created');
    console.log(`📁 See: ${instructionsPath}`);
  }
}

// Main build function
async function main() {
  const builder = new ProductionBuilder();
  await builder.build();
  
  const webStorePrep = new WebStorePrep(builder.buildDir);
  await webStorePrep.createSubmissionPackage();
  
  console.log('\n🎉 Production build complete!');
  console.log('💡 Ready for Chrome Web Store submission');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ProductionBuilder, WebStorePrep };