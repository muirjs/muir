import { muirMerge } from './merge.ts';
import { muirOssUsage, muirParseCommand } from './options.ts';
import { muirRunDriver } from './run.ts';

const command = muirParseCommand(process.argv.slice(2));

switch (command.kind) {
  case 'help': {
    process.stdout.write(`${muirOssUsage}\n`);
    break;
  }
  case 'merge': {
    process.stdout.write(
      `Wrote ${muirMerge(command.options.merge, command.options.out)}\n`,
    );
    break;
  }
  case 'run': {
    await muirRunDriver(command.options);
    break;
  }
}
