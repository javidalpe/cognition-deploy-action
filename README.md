# Cognition Deploy

Automatically deploy your JsPsych experiment to Cognition.

## Example usage

```yaml
on: [push]

jobs:
  cognition-deploy:
    runs-on: ubuntu-latest
    name: Deploy experiment to Cognition
    steps:
      - uses: actions/checkout@v3
      - uses: javidalpe/cognition-deploy-action@v1.0.0
        id: deploy
        with:
          personal-access-token: ${{secrets.PERSONAL_ACCESS_TOKEN}}
      - run: echo "The public link to the task is ${{ steps.deploy.outputs.link }}"
```

## Inputs

### `personal-access-token`

**Required** The token needed to deploy your experiment. Get one at [https://www.cognition.run/account](https://www.cognition.run/account).

### `jspsych-version`

**Optional** JsPsych library version used, e.g., 7.3.0, 6.3.1

## Outputs

### `link`

The link to the task. Share this link with your participants.

## Known issues

- Transpiled JsPsych code (jsPsych Builder) is not supported.
- Supported JsPsych versions: 6.x.x and 7.x.x