#!/bin/bash
# DOPPLER_TOKEN Must be defined in the ENV
# The token is obtained from the doppler dashboard for your account
DOPPLER_PROJECT=$1
ENVIRONMENT=$2
TENANT_NAME=$3
NAMESPACE=$4
LEGACY_DOPPLER_OPERATOR_SECRET_NAME="${TENANT_NAME}-${DOPPLER_PROJECT//_/-}"
DOPPLER_OPERATOR_SECRET_NAME="${NAMESPACE}-${DOPPLER_PROJECT//_/-}"
DOPPLER_CONFIG="${ENVIRONMENT}_${TENANT_NAME}"

main() {
  check_secret
  delete_duplicate
}

delete_duplicate() {
  if [ "$TENANT_NAME" != "$NAMESPACE" ];
  then
    CURRENT_SECRET=$(get_secret $LEGACY_DOPPLER_OPERATOR_SECRET_NAME)

    if [ "$CURRENT_SECRET" != "" ];
    then
      delete_secret "$LEGACY_DOPPLER_OPERATOR_SECRET_NAME"
    fi
  fi
}

delete_secret() {
  eval "kubectl delete secret -n doppler-operator-system $1"
}

get_secret() {
  # --template=SERVICE_TOKEN={{.data.serviceToken}} is a go template which will extract the current secret token into the string SECRET_TOKEN=<token>
  eval "kubectl get secret -n doppler-operator-system $1 --template=SERVICE_TOKEN={{.data.serviceToken}}"
}

get_doppler_service_token() {
  doppler configs tokens create \
    --config "$DOPPLER_CONFIG" \
    --project "$DOPPLER_PROJECT" \
    --name cd-job \
    --token "$DOPPLER_TOKEN" \
    --plain
}

create_secret() {
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

check_secret() {
  CURRENT_SECRET=$(get_secret $DOPPLER_OPERATOR_SECRET_NAME)
  if [ "$CURRENT_SECRET" = "SERVICE_TOKEN=" ];
  then
    echo "[create_doppler_secret] SERVICE_TOKEN is there but it's empty, deleting."
    delete_secret "$DOPPLER_OPERATOR_SECRET_NAME"
    create_secret
  elif [ "$CURRENT_SECRET" = "" ];
  then
    create_secret
  else
    echo "[create_doppler_secret] Secret is already in place."
  fi
}

main
