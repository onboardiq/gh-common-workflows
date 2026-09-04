const fs = require('fs/promises');

const {
  REGION,
  ECR_REGION,
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
      metadata: {
        annotations: {
          // Blocks Karpenter *voluntary* disruption (consolidation, drift,
          // expiration) for the life of this run. The Job has backoffLimit: 0,
          // so an evicted pod does not retry — the caller has to re-dispatch
          // the task from wherever it left off. Safe here because every pod
          // built from this manifest is a bounded one-shot task, never a
          // long-lived service pod that would need its node pinned forever.
          "karpenter.sh/do-not-disrupt": "true"
        }
      },
      spec: {
        nodeSelector: {
          "kubernetes.io/arch": "amd64"
        },
        containers: [
          {
            name: NAME,
            imagePullPolicy: "Always",
            image: `${AWS_ACCOUNT_ID}.dkr.ecr.${ECR_REGION || REGION}.amazonaws.com/${PROJECT}:${TAG}`,       command: [ COMMAND ],
            args: JSON.parse(ARGS),
            envFrom: envFrom(PROJECT, DOPPLER),
            env: [
              {
                name: "KUBE_NAMESPACE",
                value: NAMESPACE
              },
              {
                name: "RACECAR_GROUP_ID_PREFIX",
                value: `${NAMESPACE}-`
              }
            ],
            resources: {
              limits: {
                cpu: "1",
                memory: "2Gi"
              },
              requests: {
                cpu: "500m",
                memory: "1Gi"
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
