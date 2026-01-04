# TODO List

## High Priority

### Monitoring & Observability

- [ ] **Prometheus/Grafana Stack**: Integrate monitoring solution
  - Add Prometheus and Grafana services in .swarm/docker-compose.yaml
  - Configure Kong Prometheus plugin for metrics collection
  - Add dashboards for Kong, Docker Swarm, and application metrics
  - Document setup in ADMIN-SETUP.md

## Medium Priority

### Infrastructure

- [ ] **Health Checks**: Add comprehensive health checks to all services
  - Kong health check exists, add for UI and Redis
  - Document health check endpoints

- [ ] **Backup Strategy**: Document and automate backup procedures
  - Git repositories backup
  - Docker volumes backup
  - Kong configuration backup
  - GlusterFS backup (multi-node)

### 🚀 Features

- [ ] **Rate Limiting Configuration**: Add global rate limiting configuration
  - Document in APP-DEVELOPER.md
  - Provide sensible defaults
  - Describe how to change that for a single project

- [ ] **Logging Aggregation**: Consider ELK/Loki stack integration
  - Centralized logging for all services
  - Log retention policies

## Low Priority

### Testing

- [ ] **Integration Tests**: Add automated tests for deployment workflow
  - Test Kong configuration generation
  - Test Git hooks
  - Test Docker Swarm deployment

### CI/CD Enhancements

- [ ] **Automatic Updates via GitHub Actions Webhook**
  - Implement webhook-based automatic updates triggered by GitHub push
  - Components needed:
    - GitHub Actions workflow (`.github/workflows/auto-update.yml`) that triggers on push to main
    - API endpoint (`server/api/system/update.post.ts`) to receive webhook calls
    - Update script (`scripts/webhook-update.sh`) with root privileges via sudo
    - Setup script (`scripts/setup-webhook.sh`) to generate UPDATE_SECRET and configure sudoers
  - Security: Use UPDATE_SECRET for webhook authentication
  - Flow: Push to main → GitHub Actions → POST to /api/system/update → Server validates secret → Runs update script → git pull + npm install + rebuild + restart
  - Benefits: Updates within seconds after push, only on actual code changes
  - See implementation details in commit history

- [ ] **GitHub Actions**: Add CI/CD pipeline for swarm-config repository
  - Automated testing
  - Docker image building
  - Release automation

### UI Enhancements

- [ ] **Service Dashboard**: Enhance Web UI with service status overview
  - Real-time container status
  - Resource usage metrics
  - Deployment history

- Completed items will be removed

---

_Last updated: 2026-01-04_
