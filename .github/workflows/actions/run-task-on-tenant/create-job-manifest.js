const fs = require('fs/promises');

const {
  REGION,
  NAMESPACE,
  PROJECT,
  COMMAND,
  ARGS,
  NAME,
  AWS_ACCOUNT_ID,
  TAG,
  DOPPLER
} = process.env;

function envFrom(project, doppler) {
  if (doppler) {
    return [
      { secretRef: { name: `${PROJECT}-doppler-env` } }
    ];
  } else {
    return [
      { configMapRef: { name: `${PROJECT}-env` } }
    ];
  }
}

const jobTimestamp = new Date()
      .toISOString()
      .replaceAll(/[:.T]/g, '-')
      .toLowerCase();

const content = {
  apiVersion: "batch/v1",
  kind: "Job",
  metadata: {
    name: `${NAME}-${jobTimestamp}`,
    namespace: NAMESPACE,
  },
  spec: {
    backoffLimit: 0,
    completions: 1,
    parallelism: 1,
    template: {
      spec: {
        containers: [
          {
            name: NAME,
            imagePullPolicy: "Always",
            image: `${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT}:${TAG}`,       command: [ COMMAND ],
            args: JSON.parse(ARGS),
            envFrom: envFrom(PROJECT, DOPPLER),
            resources: {
              limits: {
                cpu: "1",
                memory: "4Gi"
              },
              requests: {
                cpu: "1",
                memory: "4Gi"
              }
            }
          }
        ],
        restartPolicy: "Never"
      }
    }
  }
};


fs.writeFile('./job.json', JSON.stringify(content, null, 2));
