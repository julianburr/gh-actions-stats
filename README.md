# gh-actions-stats

Minimal cli to get stats on Gihub Actions usage.

```bash
# See all available options
npx gh-actions-stats --help

# Get stats for all repos for the past 7 days
npx gh-actions-stats --token=$PAT --org=YourOrgName --days=7

# Get stats for specific repo
npx gh-actions-stats --token=$PAT --org=YourOrgName --repo=YourRepoName --days=7

# Get stats for advanced time range
# See https://docs.github.com/en/search-github/getting-started-with-searching-on-github/understanding-the-search-syntax#query-for-dates for syntax
npx gh-actions-stats --token=$PAT --org=YourOrgName --created=2022-01-01..2022-01-31
```
