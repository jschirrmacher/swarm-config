# TODO List

## High Priority

### Monitoring & Observability

- [ ] **Prometheus/Grafana Stack**: Integrate monitoring solution
  - Add Prometheus and Grafana services in .swarm/docker-compose.yaml
  - Configure Kong Prometheus plugin for metrics collection
  - Add dashboards for Kong, Docker Swarm, and application metrics
  - Document setup in ADMIN-SETUP.md

## Medium Priority

### 📚 Documentation

- [ ] **English Documentation**: Translate all documentation to English
  - [ ] ADMIN-SETUP.md
  - [ ] APP-DEVELOPER.md
  - [ ] CONTRIBUTING.md
  - [ ] MULTI-NODE-SETUP.md
  - [ ] README.md

### 🔧 Infrastructure

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

### 🧪 Testing

- [ ] **Integration Tests**: Add automated tests for deployment workflow
  - Test Kong configuration generation
  - Test Git hooks
  - Test Docker Swarm deployment

### 📦 CI/CD Enhancements

- [ ] **GitHub Actions**: Add CI/CD pipeline for swarm-config repository
  - Automated testing
  - Docker image building
  - Release automation

### 🎨 UI Enhancements

- [ ] **Service Dashboard**: Enhance Web UI with service status overview
  - Real-time container status
  - Resource usage metrics
  - Deployment history

## Notes

- Items marked with 🔒 are security-related
- Items marked with 📊 are monitoring-related
- Items marked with 📚 are documentation-related
- Completed items are removed

---

_Last updated: 2026-01-01_
