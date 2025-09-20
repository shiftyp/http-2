#!/usr/bin/env node

/**
 * Spec Kit Parser for Kiro IDE Integration
 *
 * Parses spec kit files and provides real-time updates to Kiro IDE
 * about specification progress, task completion, and implementation status.
 */

const fs = require('fs').promises;
const path = require('path');

class SpecKitParser {
  constructor(specsDirectory = 'specs') {
    this.specsDirectory = specsDirectory;
    this.cache = new Map();
  }

  /**
   * Parse all specifications and return comprehensive status
   */
  async parseAllSpecs() {
    try {
      const specDirs = await this.getSpecDirectories();
      const specs = {};

      for (const specDir of specDirs) {
        const specNumber = path.basename(specDir);
        const specData = await this.parseSpec(specDir);
        specs[specNumber] = specData;
      }

      return {
        total: Object.keys(specs).length,
        specs,
        lastUpdated: new Date().toISOString(),
        summary: this.generateSummary(specs)
      };
    } catch (error) {
      console.error('Error parsing specs:', error);
      throw error;
    }
  }

  /**
   * Parse individual specification
   */
  async parseSpec(specDir) {
    const specNumber = path.basename(specDir);

    try {
      const [plan, tasks, dataModel, quickstart, research] = await Promise.allSettled([
        this.parsePlanFile(specDir),
        this.parseTasksFile(specDir),
        this.parseDataModelFile(specDir),
        this.parseQuickstartFile(specDir),
        this.parseResearchFile(specDir)
      ]);

      const contracts = await this.parseContractsDirectory(specDir);

      return {
        number: specNumber,
        title: plan.status === 'fulfilled' ? plan.value.title : 'Unknown',
        description: plan.status === 'fulfilled' ? plan.value.description : '',
        status: this.determineSpecStatus(tasks.value, contracts),
        priority: plan.status === 'fulfilled' ? plan.value.priority : 'medium',
        category: plan.status === 'fulfilled' ? plan.value.category : 'unknown',
        tasks: tasks.status === 'fulfilled' ? tasks.value : { completed: 0, total: 0, percentage: 0 },
        contracts: contracts,
        files: {
          plan: plan.status === 'fulfilled',
          tasks: tasks.status === 'fulfilled',
          dataModel: dataModel.status === 'fulfilled',
          quickstart: quickstart.status === 'fulfilled',
          research: research.status === 'fulfilled'
        },
        lastModified: await this.getLastModified(specDir)
      };
    } catch (error) {
      console.error(`Error parsing spec ${specNumber}:`, error);
      return {
        number: specNumber,
        title: 'Parse Error',
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Parse plan.md file
   */
  async parsePlanFile(specDir) {
    const planPath = path.join(specDir, 'plan.md');

    try {
      const content = await fs.readFile(planPath, 'utf-8');
      const lines = content.split('\n');

      // Extract title from first heading
      const titleLine = lines.find(line => line.startsWith('# '));
      const title = titleLine ? titleLine.replace('# ', '').trim() : 'Unknown';

      // Extract description from first paragraph
      const descriptionStart = lines.findIndex(line => line.trim() && !line.startsWith('#'));
      const description = descriptionStart >= 0 ? lines[descriptionStart].trim() : '';

      // Extract priority if mentioned
      const priorityMatch = content.match(/priority:\s*(critical|high|medium|low)/i);
      const priority = priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';

      // Extract category if mentioned
      const categoryMatch = content.match(/category:\s*(\w+)/i);
      const category = categoryMatch ? categoryMatch[1].toLowerCase() : 'unknown';

      return { title, description, priority, category };
    } catch (error) {
      throw new Error(`Cannot read plan.md: ${error.message}`);
    }
  }

  /**
   * Parse tasks.md file for completion tracking
   */
  async parseTasksFile(specDir) {
    const tasksPath = path.join(specDir, 'tasks.md');

    try {
      const content = await fs.readFile(tasksPath, 'utf-8');
      const lines = content.split('\n');

      const completedTasks = lines.filter(line => /^\s*-\s*\[x\]/i.test(line)).length;
      const totalTasks = lines.filter(line => /^\s*-\s*\[[x\s]\]/i.test(line)).length;
      const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        completed: completedTasks,
        total: totalTasks,
        percentage,
        details: this.extractTaskDetails(lines)
      };
    } catch (error) {
      throw new Error(`Cannot read tasks.md: ${error.message}`);
    }
  }

  /**
   * Extract detailed task information
   */
  extractTaskDetails(lines) {
    const tasks = [];
    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').trim();
      } else if (/^\s*-\s*\[[x\s]\]/i.test(line)) {
        const completed = /^\s*-\s*\[x\]/i.test(line);
        const task = line.replace(/^\s*-\s*\[[x\s]\]\s*/i, '').trim();
        tasks.push({
          section: currentSection,
          task,
          completed
        });
      }
    }

    return tasks;
  }

  /**
   * Parse contracts directory
   */
  async parseContractsDirectory(specDir) {
    const contractsPath = path.join(specDir, 'contracts');

    try {
      const files = await fs.readdir(contractsPath);
      const contractFiles = files.filter(file => file.endsWith('.test.ts') || file.endsWith('.test.js'));

      return {
        hasContracts: contractFiles.length > 0,
        files: contractFiles,
        count: contractFiles.length
      };
    } catch (error) {
      return {
        hasContracts: false,
        files: [],
        count: 0
      };
    }
  }

  /**
   * Parse optional files
   */
  async parseDataModelFile(specDir) {
    return await this.parseOptionalFile(specDir, 'data-model.md');
  }

  async parseQuickstartFile(specDir) {
    return await this.parseOptionalFile(specDir, 'quickstart.md');
  }

  async parseResearchFile(specDir) {
    return await this.parseOptionalFile(specDir, 'research.md');
  }

  async parseOptionalFile(specDir, filename) {
    const filePath = path.join(specDir, filename);

    try {
      await fs.access(filePath);
      return { exists: true, path: filePath };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Determine specification status based on tasks and contracts
   */
  determineSpecStatus(tasks, contracts) {
    if (!tasks || tasks.total === 0) {
      return contracts?.hasContracts ? 'planning' : 'not-planned';
    }

    if (tasks.percentage === 0) {
      return 'ready';
    } else if (tasks.percentage < 50) {
      return 'in-progress';
    } else if (tasks.percentage < 100) {
      return 'testing';
    } else {
      return 'completed';
    }
  }

  /**
   * Get spec directories
   */
  async getSpecDirectories() {
    try {
      const items = await fs.readdir(this.specsDirectory, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory() && /^\d{3}-/.test(item.name))
        .map(item => path.join(this.specsDirectory, item.name))
        .sort();
    } catch (error) {
      throw new Error(`Cannot read specs directory: ${error.message}`);
    }
  }

  /**
   * Get last modified time
   */
  async getLastModified(specDir) {
    try {
      const files = ['plan.md', 'tasks.md'].map(f => path.join(specDir, f));
      const stats = await Promise.allSettled(files.map(f => fs.stat(f)));

      const validStats = stats
        .filter(s => s.status === 'fulfilled')
        .map(s => s.value.mtime);

      return validStats.length > 0 ? Math.max(...validStats.map(d => d.getTime())) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate summary statistics
   */
  generateSummary(specs) {
    const specArray = Object.values(specs);
    const totalTasks = specArray.reduce((sum, spec) => sum + (spec.tasks?.total || 0), 0);
    const completedTasks = specArray.reduce((sum, spec) => sum + (spec.tasks?.completed || 0), 0);

    const statusCounts = {};
    const categoryCounts = {};

    for (const spec of specArray) {
      statusCounts[spec.status] = (statusCounts[spec.status] || 0) + 1;
      categoryCounts[spec.category] = (categoryCounts[spec.category] || 0) + 1;
    }

    return {
      totalSpecs: specArray.length,
      totalTasks,
      completedTasks,
      overallCompletion: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      statusBreakdown: statusCounts,
      categoryBreakdown: categoryCounts
    };
  }

  /**
   * Watch for file changes and update cache
   */
  async watchSpecs(callback) {
    const chokidar = require('chokidar');

    const watcher = chokidar.watch([
      path.join(this.specsDirectory, '*/plan.md'),
      path.join(this.specsDirectory, '*/tasks.md'),
      path.join(this.specsDirectory, '*/contracts/*.ts')
    ]);

    watcher.on('change', async (filePath) => {
      const specDir = path.dirname(filePath);
      const specNumber = path.basename(specDir);

      try {
        const updatedSpec = await this.parseSpec(specDir);
        this.cache.set(specNumber, updatedSpec);

        if (callback) {
          callback({
            type: 'spec-updated',
            specNumber,
            data: updatedSpec
          });
        }
      } catch (error) {
        console.error(`Error updating spec ${specNumber}:`, error);
      }
    });

    return watcher;
  }
}

// CLI interface
if (require.main === module) {
  const parser = new SpecKitParser();

  parser.parseAllSpecs()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = SpecKitParser;