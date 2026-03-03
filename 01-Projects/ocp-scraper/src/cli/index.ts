#!/usr/bin/env bun
import { Command } from 'commander';
import { scrapeCommand } from './scrape';
import { searchCommand } from './search';
import { statusCommand } from './status';
import { inspectCommand } from './inspect';
import { seedCommand } from './seed';
import { templateCommand } from './template';
import { reclassifyCommand } from './reclassify';
import { gapsCommand } from './gaps';
import { coverageCommand } from './coverage';
import { feedbackCommand } from './feedback';
import { publishCommand } from './publish';
import { subscribeCommand } from './subscribe';

const program = new Command();

program
  .name('ocp')
  .description('OCP Scraper — Observer Commons Protocol Knowledge Crystallizer')
  .version('0.1.0');

program.addCommand(scrapeCommand);
program.addCommand(searchCommand);
program.addCommand(statusCommand);
program.addCommand(inspectCommand);
program.addCommand(seedCommand);
program.addCommand(templateCommand);
program.addCommand(reclassifyCommand);
program.addCommand(gapsCommand);
program.addCommand(coverageCommand);
program.addCommand(feedbackCommand);
program.addCommand(publishCommand);
program.addCommand(subscribeCommand);

program.parse();
