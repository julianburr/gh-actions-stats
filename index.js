#!/usr/bin/env node

import { Octokit } from "@octokit/rest";
import Table from "cli-table";
import ora from "ora";
import yargs from "yargs/yargs";
import dayjs from "dayjs";
import colors from "colors";

async function getUsage(argv) {
  const githubToken = argv.token || process.env.GH_PAT;
  const octokit = new Octokit({ auth: githubToken });

  const spinner = ora("Loading...").start();

  let repos = [];
  if (argv.repo) {
    repos = [{ name: argv.repo }];
  } else {
    spinner.text = "Loading repos...";
    repos = await octokit.paginate(`GET /orgs/{org}/repos`, { org: argv.org });
  }

  let tables = [];
  for (const repo of repos) {
    const formatedDate = dayjs()
      .subtract(argv.days, "days")
      .format("YYYY-MM-DD HH:mm:ss");
    const created = argv.created || `>${formatedDate}+10:00`;

    spinner.text = `[${repo.name}] Loading runs ${colors.dim(
      `(${created})`
    )} ...`;

    const runs = await octokit.paginate(
      `GET /repos/{owner}/{repo}/actions/runs`,
      { owner: argv.org, repo: repo.name, created }
    );

    spinner.text = `[${repo.name}] Loading workflows ...`;
    let workflows = await octokit.paginate(
      `GET /repos/{owner}/{repo}/actions/workflows`,
      { owner: argv.org, repo: repo.name }
    );

    workflows.forEach((workflow) => {
      workflow.runs = [];
    });

    spinner.text = `[${repo.name}] Loading usage ...`;
    for (const run of runs) {
      const usage = await octokit.request(
        `GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing`,
        { owner: argv.org, repo: repo.name, run_id: run.id }
      );
      run.usage = usage.data;

      let workflow = workflows.find((w) => w.id === run.workflow_id);
      if (!workflow) {
        const fetch = await octokit.request(
          `GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}`,
          { owner: argv.org, repo: repo.name, workflow_id: run.workflow_id }
        );
        workflow = fetch.data;
        workflow.name = colors.dim(workflow.name);
        workflow.runs = [];
        workflows.push(workflow);
      }

      workflow.runs?.push(run);
    }

    const table = new Table({
      chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" },
      colAligns: ["left", "left", "right", "right", "right"],
    });

    if (workflows.length) {
      table.push([
        colors.bold("Workflow"),
        colors.bold("Runs"),
        colors.bold("Usage (Ubuntu)"),
        colors.bold("Usage (MacOS)"),
        colors.bold("Usage (Windows)"),
      ]);

      for (const workflow of workflows) {
        table.push([
          workflow.name,
          workflow.runs?.length,
          ...(workflow.runs?.reduce?.(
            (all, run) => {
              const ubuntu = run.usage?.billable.UBUNTU
                ? run.usage.billable.UBUNTU.total_ms / 1000 / 60
                : 0;
              const macos = run.usage?.billable.MACOS
                ? run.usage.billable.MACOS.total_ms / 1000 / 60
                : 0;
              const windows = run.usage?.billable.WINDOWS
                ? run.usage.billable.WINDOWS.total_ms / 1000 / 60
                : 0;
              return [all[0] + ubuntu, all[1] + macos, all[2] + windows];
            },
            [0, 0, 0]
          ) || []),
        ]);
      }

      tables.push({ name: repo.name, table });
    }
  }

  spinner.stop();
  tables.forEach((t) => {
    if (tables.length > 1) {
      console.log();
      console.log(t.name);
    }
    console.log(t.table.toString());
  });
}

yargs(process.argv.slice(2))
  .scriptName("gh-actions-stats")
  .usage("$0 [args]")
  .command(
    "$0",
    "Show stats on Github action usage",
    (yargs) =>
      yargs
        .option("token", {
          describe: "Github personal access token",
        })
        .option("org", {
          describe: "Github org name",
        })
        .option("repo", {
          describe: "Github repo name",
        })
        .option("days", {
          describe: "Number of days to include in the stats",
          type: "number",
          default: 7,
        })
        .option("created", {
          describe: "Github search string for run created range",
        }),
    (argv) =>
      getUsage(argv).catch((e) => {
        console.error(e);
        process.exit(1);
      })
  )
  .help().argv;
