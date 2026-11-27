FROM fluent/fluentd-kubernetes-daemonset:v1.17-debian-forward-1

# Install Loki output plugin (pinned version)
USER root
RUN gem install fluent-plugin-grafana-loki -v 1.2.20 --no-document \
    && gem cleanup
# Base image requires root to read host log files (see README.md)
