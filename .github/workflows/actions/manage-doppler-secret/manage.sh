#!/bin/bash
# DOPPLER_TOKEN Must be defined in the ENV
# The token is obtained from the doppler dashboard for your account
DOPPLER_PROJECT=$1
NAMESPACE=$2
ENVIRONMENT=$3
DOPPLER_OPERATOR_SECRET_NAME="${NAMESPACE}-${DOPPLER_PROJECT//_/-}"
DOPPLER_CONFIG="${ENVIRONMENT}_${NAMESPACE}"

function main(){
  CURRENT_SECRET=$(get_current_secret)
  if [ "$CURRENT_SECRET" = "SERVICE_TOKEN=" ]; 
  then
    echo "[create_doppler_secret] SERVICE_TOKEN is there but it's empty, deleting."
    kubectl delete secret "$DOPPLER_OPERATOR_SECRET_NAME"
    create_secret
  elif [ "$CURRENT_SECRET" = "" ]; 
  then
    create_secret
  else
    echo "[create_doppler_secret] Secret is already in place."
  fi
}

function get_current_secret() {
  # --template=SERVICE_TOKEN={{.data.serviceToken}} is a go template which will exract the current secret token into the string SECRET_TOKEN=<token>
  eval "kubectl get secret -n doppler-operator-system $DOPPLER_OPERATOR_SECRET_NAME --template=SERVICE_TOKEN={{.data.serviceToken}}"
}

function get_doppler_service_token() {
  doppler configs tokens create \
    --config "$DOPPLER_CONFIG" \
    --project "$DOPPLER_PROJECT" \
    --name cd-job \
    --token "$DOPPLER_TOKEN" \
    --plain
}

function create_secret() {
  echo "[create_doppler_secret] Creating secret"
  DOPPLER_SERVICE_TOKEN="$(get_doppler_service_token)"
  if [ "$DOPPLER_SERVICE_TOKEN" = "" ];
  then
    echo "[create_doppler_secret] Problem creating the Doppler Service Token, exiting."
    echo "## There was an error creating the Doppler Service Token" >> "$GITHUB_STEP_SUMMARY";
    exit 1
  else
    kubectl create secret generic "$DOPPLER_OPERATOR_SECRET_NAME" \
          --namespace doppler-operator-system \
          --from-literal=serviceToken="$DOPPLER_SERVICE_TOKEN"
  fi
}

main