import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const installer = join(root, 'scripts/install-brawl-auto-update.sh');
const autoUpdateScript = join(root, 'scripts/auto-update-brawl-ecs.sh');

const fakeTool = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const tool = path.basename(process.argv[1]), args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({tool,args}) + '\\n');
if (process.env.MOCK_FAIL === tool) process.exit(1);
if (tool === 'id') console.log('0');
if (tool === 'git') {
  if (args[0] === 'symbolic-ref') console.log('main');
  if (args[0] === 'status') {
    if (process.env.MOCK_DIRTY === '1') console.log(' M package.json');
    else console.log('');
  }
  if (args[0] === 'rev-parse') {
    if (args.includes('HEAD')) console.log(process.env.MOCK_LOCAL_REV || '1111111111111111111111111111111111111111');
    else if (args.includes('origin/main')) console.log(process.env.MOCK_REMOTE_REV || '1111111111111111111111111111111111111111');
    else console.log('1111111');
  }
  if (args[0] === 'fetch') process.exit(0);
  if (args[0] === 'merge') process.exit(0);
}
if (tool === 'systemctl') {
  process.exit(0);
}
if (tool === 'systemd-analyze') {
  process.exit(0);
}
if (tool === 'crontab') {
  if (args[0] === '-l') console.log(process.env.MOCK_CRON || '');
  else process.exit(0);
}
if (tool === 'docker') {
  process.exit(0);
}
`;

function setupEnv(t) {
  const dir = mkdtempSync(join(tmpdir(), 'brawl-auto-install-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  for (const part of ['scripts', 'deploy/systemd', 'deploy/runtime', 'bin', 'etc/systemd/system']) {
    mkdirSync(join(dir, part), { recursive: true });
  }

  copyFileSync(installer, join(dir, 'scripts/install-brawl-auto-update.sh'));
  copyFileSync(autoUpdateScript, join(dir, 'scripts/auto-update-brawl-ecs.sh'));
  copyFileSync(join(root, 'deploy/systemd/avalon-brawl-auto-update.service'), join(dir, 'deploy/systemd/avalon-brawl-auto-update.service'));
  copyFileSync(join(root, 'deploy/systemd/avalon-brawl-auto-update.timer'), join(dir, 'deploy/systemd/avalon-brawl-auto-update.timer'));

  for (const tool of ['id', 'git', 'flock', 'systemctl', 'systemd-analyze', 'crontab', 'docker']) {
    writeFileSync(join(dir, 'bin', tool), fakeTool, { mode: 0o700 });
  }

  const log = join(dir, 'commands.jsonl');
  const env = {
    ...process.env,
    BRAWL_DIR: dir,
    SYSTEMD_DIR: join(dir, 'etc/systemd/system'),
    MOCK_LOG: log,
    PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
  };

  return { dir, log, env };
}

test('install-brawl-auto-update: installs systemd service and timer with correct working directory', (t) => {
  const { dir, log, env } = setupEnv(t);
  const result = spawnSync('bash', [join(dir, 'scripts/install-brawl-auto-update.sh')], {
    encoding: 'utf8',
    env,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('安装成功'), 'Stdout reports success');

  assert.ok(existsSync(join(dir, 'etc/systemd/system/avalon-brawl-auto-update.service')), 'Service file created');
  assert.ok(existsSync(join(dir, 'etc/systemd/system/avalon-brawl-auto-update.timer')), 'Timer file created');

  const commands = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    : [];

  const systemctl = commands.filter(c => c.tool === 'systemctl').map(c => c.args);
  assert.deepEqual(systemctl, [
    ['daemon-reload'],
    ['enable', 'avalon-brawl-auto-update.timer'],
    ['restart', 'avalon-brawl-auto-update.timer'],
    ['list-timers', '--all', 'avalon-brawl-auto-update.timer', '--no-pager'],
  ]);
});

test('install-brawl-auto-update: --cron mode configures crontab correctly', (t) => {
  const { dir, log, env } = setupEnv(t);
  const result = spawnSync('bash', [join(dir, 'scripts/install-brawl-auto-update.sh'), '--cron'], {
    encoding: 'utf8',
    env: { ...env, MOCK_CRON: '# existing cron\n' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('Crontab 定时任务已配置生效'), 'Stdout reports cron success');

  const commands = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    : [];

  const crontabCalls = commands.filter(c => c.tool === 'crontab');
  assert.ok(crontabCalls.length >= 2, 'crontab was called to read and update');
});

test('auto-update-brawl-ecs: skips deployment when remote commit equals local commit', (t) => {
  const { dir, env } = setupEnv(t);
  writeFileSync(join(dir, 'deploy/runtime/last-deployed-brawl-commit'), '1111111111111111111111111111111111111111\n');

  const result = spawnSync('bash', [join(dir, 'scripts/auto-update-brawl-ecs.sh')], {
    encoding: 'utf8',
    env: {
      ...env,
      MOCK_LOCAL_REV: '1111111111111111111111111111111111111111',
      MOCK_REMOTE_REV: '1111111111111111111111111111111111111111',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('无新提交'), 'Outputs no updates');
});

test('auto-update-brawl-ecs: pulls and deploys when new remote commit is detected', (t) => {
  const { dir, log, env } = setupEnv(t);
  // Create mock update-brawl-ecs.sh
  writeFileSync(
    join(dir, 'deploy/update-brawl-ecs.sh'),
    '#!/usr/bin/env bash\necho "MOCK BUILD SUCCESS"\n',
    { mode: 0o700 }
  );

  const result = spawnSync('bash', [join(dir, 'scripts/auto-update-brawl-ecs.sh')], {
    encoding: 'utf8',
    env: {
      ...env,
      MOCK_LOCAL_REV: '1111111111111111111111111111111111111111',
      MOCK_REMOTE_REV: '2222222222222222222222222222222222222222',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('检测到新版本'), 'Detects new version');
  assert.ok(result.stdout.includes('MOCK BUILD SUCCESS'), 'Executes rebuild');
  assert.ok(result.stdout.includes('自动更新发布完成'), 'Reports deploy success');
});

test('auto-update-brawl-ecs: halts if worktree has uncommitted changes', (t) => {
  const { dir, env } = setupEnv(t);
  const result = spawnSync('bash', [join(dir, 'scripts/auto-update-brawl-ecs.sh')], {
    encoding: 'utf8',
    env: {
      ...env,
      MOCK_DIRTY: '1',
    },
  });

  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('存在未提交改动'), 'Reports dirty worktree caution');
});
