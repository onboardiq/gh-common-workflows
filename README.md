# gh-common-workflows
Common CI/CD workflows


These workflows and actions form the base of how we do CI/CD at Fountain

## Workflows

### CI

This re-usable workflow is able to generically build most projects we use. Some repos may need to define some pre- or post- actions (e.g. pushing source maps to New Relic), but this core workflow will:

* Build a docker container
* Push it to all Container Registries it needs to be in (injected at runtime by configuration stored elsewhere)
* Build a Helm Chart
* Push it in parallel to the chart repositories it needs to be present in
* Post to slack when the pipeline finishes

Use it like:

```yaml
name: 'CI'
description: "My project's specific CI pipeline"
jobs:
    ci:
      uses: onboardiq/gh-common-workflows/workflows/ci.yaml@main
      with:
        # My Project name, is also the base image name
        project-name: my-project
  
        # If my project is a Rails app, I can set this flag to true to get
        # a cached pre-docker-build asset step
        build-assets: false
  
        # The version of my Helm Chart
        helm-chart-version: 1.0.0
  
        # The specific version of Helm I want my project to use,
        # the default is probably what you should use
        helm-version: 3.4.1

      secrets:
        # AWS credentials with sufficient permissions to push to ECR
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  
        # Azure credentials able to push to ACR
        azure-registry-username: ${{ secrets.REGISTRY_USERNAME }}
        azure-registry-password: ${{ secrets.REGISTRY_PASSWORD }}
  
        # Helm Repo Credentials
        helm-repo-username: ${{ secrets.HELM_REPO_USERNAME }}
        helm-repo-password: ${{ secrets.HELM_REPO_PASSWORD }}
```

### CD

Thanks to Helm and our projects using a consistent Makefile interface to Helm, we're able to have one CD workflow that is able to deploy most projects.

It will:

* Deploy to a specific set kubernetes clusters (injected at runtime from configuration stored elsewhere)
* Create a Github Release with auto-generated release notes
* Post to slack when the pipeline finishes

Some projects may need to customize pre- or post-actions or preflight checks based on their branching strategy.

Use it like:

```yaml
name: 'CD'
description: "My project's specific CD pipeline"
jobs:
  cd:
    uses: onboardiq/gh-common-workflows/workflows/cd.yaml@main
    with:
      # The name of my project, is also the Docker image name
      project-name: 'my-project'

      # The set of tenants to deploy to, for instance 'prod' or 'uat' or 'dev'.
      # In a real pipeline this might be determined by branch name
      env: 'prod'

      # The branch or tag name or git SHA hash that we'll be deploying
      ref: ${{ github.sha }}

      # Set this flag to only do a dry-run of deployments
      dry-run: false
    secrets:
      # AWS credentials with sufficient permissions to push to ECR
      aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
      aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  

      # Helm Repo Credentials
      helm-repo-username: ${{ secrets.HELM_REPO_USERNAME }}
      helm-repo-password: ${{ secrets.HELM_REPO_PASSWORD }}

      # A Github user oauth token that can create, approve, and merge PRs
      github-automation-token: ${{ secrets.GH_AUTOMATION_TOKEN }}
```

## Actions

TODO: Fill out the action definitions

### notify-slack-pipeline-status
### merge-stable-to-master
### create-github-release
### deploy-to-tenant
### ecr-login
### version
### build-assets
### helm-push
### docker-build
