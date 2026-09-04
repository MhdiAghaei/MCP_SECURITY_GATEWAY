import type { AuditEvent, DashboardStats, RiskStats, ToolStats } from "./types";

import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  Alert,
  Button,
  Card,
  Col,
  Layout,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";

import type { TableProps } from "antd";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getAuditLogs, getRiskStats, getStats, getToolStats } from "./api";

import "./App.css";

const { Header, Content } = Layout;

const { Title, Text } = Typography;

function App() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [riskStats, setRiskStats] = useState<RiskStats | null>(null);

  const [toolStats, setToolStats] = useState<ToolStats>({});

  const [logs, setLogs] = useState<AuditEvent[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsResponse, riskResponse, toolsResponse, auditResponse] =
        await Promise.all([
          getStats(),
          getRiskStats(),
          getToolStats(),
          getAuditLogs(),
        ]);

      setStats(statsResponse);
      setRiskStats(riskResponse);

      setToolStats(toolsResponse);

      setLogs(auditResponse.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadDashboard]);

  const riskChartData = useMemo(() => {
    if (!riskStats) {
      return [];
    }

    return [
      {
        name: "LOW",
        value: riskStats.LOW,
      },
      {
        name: "MEDIUM",
        value: riskStats.MEDIUM,
      },
      {
        name: "HIGH",
        value: riskStats.HIGH,
      },
      {
        name: "CRITICAL",
        value: riskStats.CRITICAL,
      },
    ];
  }, [riskStats]);

  const eventChartData = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      {
        name: "Tool Access",
        count: stats.securityEvents.toolAccess,
      },
      {
        name: "Policy Denied",
        count: stats.securityEvents.policyDenied,
      },
      {
        name: "Rate Limit",
        count: stats.securityEvents.rateLimitExceeded,
      },
      {
        name: "Auth Failed",
        count: stats.securityEvents.authenticationFailed,
      },
    ];
  }, [stats]);

  const toolChartData = useMemo(
    () =>
      Object.entries(toolStats).map(([name, value]) => ({
        name,
        ...value,
      })),
    [toolStats],
  );

  const columns: TableProps<AuditEvent>["columns"] = [
    {
      title: "Time",
      dataIndex: "timestamp",
      width: 190,

      render: (value: string) => new Date(value).toLocaleString(),
    },

    {
      title: "Event",
      dataIndex: "eventType",
      width: 210,

      render: (eventType) => <Tag>{eventType}</Tag>,
    },

    {
      title: "Client",
      dataIndex: "clientName",
      width: 170,
    },

    {
      title: "Role",
      dataIndex: "role",
      width: 110,

      render: (role) => role ?? "-",
    },

    {
      title: "Tool",
      dataIndex: "tool",
      width: 170,
    },

    {
      title: "Risk",
      dataIndex: "risk",
      width: 110,

      render: (risk) => {
        const color =
          risk === "CRITICAL"
            ? "red"
            : risk === "HIGH"
              ? "volcano"
              : risk === "MEDIUM"
                ? "orange"
                : "green";

        return <Tag color={color}>{risk}</Tag>;
      },
    },

    {
      title: "Decision",
      dataIndex: "decision",
      width: 110,

      render: (decision) => (
        <Tag color={decision === "ALLOW" ? "success" : "error"}>{decision}</Tag>
      ),
    },

    {
      title: "Duration",
      dataIndex: "durationMs",
      width: 120,

      render: (duration) => `${duration} ms`,
    },

    {
      title: "Reason",
      dataIndex: "reason",
      ellipsis: true,
    },
  ];

  return (
    <Layout className="dashboard-layout">
      <Header className="dashboard-header">
        <div>
          <Title level={3} className="dashboard-title">
            <SafetyCertificateOutlined />
            MCP Security Gateway
          </Title>

          <Text className="dashboard-subtitle">
            Security Monitoring Dashboard
          </Text>
        </div>

        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            void loadDashboard();
          }}
          loading={loading}
        >
          Refresh
        </Button>
      </Header>

      <Content className="dashboard-content">
        {error && (
          <Alert
            type="error"
            showIcon
            message="Monitoring API unavailable"
            description={error}
            className="dashboard-alert"
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic
                title="Total Requests"
                value={stats?.totalRequests ?? 0}
                prefix={<AlertOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic
                title="Allowed"
                value={stats?.allowed ?? 0}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic
                title="Denied"
                value={stats?.denied ?? 0}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} md={12} xl={6}>
            <Card>
              <Statistic
                title="High Risk Events"
                value={stats?.highRisk ?? 0}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="dashboard-section">
          <Col xs={24} xl={8}>
            <Card title="Risk Distribution" className="chart-card">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={105}
                    label
                  >
                    {riskChartData.map((entry) => (
                      <Cell key={entry.name} />
                    ))}
                  </Pie>

                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            <Card title="Security Events" className="chart-card">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={eventChartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="name" />

                  <YAxis allowDecimals={false} />

                  <Tooltip />

                  <Bar dataKey="count" name="Events" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            <Card title="Tool Activity" className="chart-card">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={toolChartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="name" />

                  <YAxis allowDecimals={false} />

                  <Tooltip />
                  <Legend />

                  <Bar dataKey="allowed" name="Allowed" />

                  <Bar dataKey="denied" name="Denied" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="dashboard-section">
          <Col xs={24} md={12}>
            <Card>
              <Statistic
                title="Average Execution Duration"
                value={stats?.averageDurationMs ?? 0}
                suffix="ms"
                precision={2}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card>
              <Space direction="vertical">
                <Text type="secondary">Authentication Failures</Text>

                <Title
                  level={2}
                  style={{
                    margin: 0,
                  }}
                >
                  {stats?.securityEvents.authenticationFailed ?? 0}
                </Title>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card title="Security Audit Log" className="dashboard-section">
          <Table<AuditEvent>
            rowKey={(record) =>
              `${record.timestamp}-${record.eventType}-${record.tool}`
            }
            columns={columns}
            dataSource={logs}
            loading={loading}
            scroll={{
              x: 1350,
            }}
            pagination={{
              pageSize: 10,
            }}
          />
        </Card>
      </Content>
    </Layout>
  );
}

export default App;
