---
title: GitHub deploys the cloud functions through a keyless link that only this repository may use
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 17, tokens: 30228 }
id: l-e03f7b52
scope: repo
status: active
src: agent
touches:
  - ".github/workflows/deploy-get-photo-signed-url.yml"
  - cloud/google-cloud-functions/README.md
  - cloud/google-cloud-functions/getPhotoSignedUrl-function-source/cloudbuild.yaml
---

## Decided
The function deploy workflows authenticate to Google Cloud with workload identity federation, limited to this repository, so no key file exists. The deployer account mirrors the roles it had in the old project.

## Watch out
The mirrored roles were not enough: the notifications deploy also needs read access to secret metadata, because the Firebase CLI checks the push secrets before deploying.
The local remote to Tieme's repository has its push address disabled on purpose; a push there would switch his site to this database.
An automated attempt to disable workflows on the repository is blocked by the permission settings.

In the code: roles/secretmanager.viewer on github-function-deployer@coffee-dial-buzink.iam.gserviceaccount.com; pool github-pool, provider github-provider with assertion.repository=='buzink/Coffee-Dial'; GitHub secrets GCP_PROJECT_ID, GCP_DEPLOYER_SERVICE_ACCOUNT, GCP_WORKLOAD_IDENTITY_PROVIDER; remote "tieme".
