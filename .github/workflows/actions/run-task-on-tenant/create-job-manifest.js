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
        // Karpenter evicts this pod when it consolidates an underutilized node,
        // which kills the task mid-run: the Job carries backoffLimit 0, so one
        // eviction ends it. A task that takes longer than a consolidation
        // interval therefore cannot finish. The annotation blocks voluntary
        // disruption for the life of the run and the node is reclaimable again
        // after it. Safe here because a Job is finite -- the same reason
        // dagster-v2 sets it on run pods and not on its long-lived ones.
        annotations: {
          "karpenter.sh/do-not-disrupt": "true"
        }
      },
      spec: {
        // The images this action runs are amd64-only, and the cluster has a few
        // arm64 nodes outside the default pool. Without this the pod lands on
        // one occasionally and dies before the entrypoint with
        // "exec format error".
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
