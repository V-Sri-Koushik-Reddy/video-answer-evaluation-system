import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  FileJson,
  Gauge,
  Clock3,
  Mic,
  Activity,
  Search,
  AlertTriangle,
} from "lucide-react";

const sampleData = {
  full_transcript:
    "Machine learning is a branch of artificial intelligence that helps systems learn from data and make predictions. It includes supervised, unsupervised, and reinforcement learning.",
  structured_timeline: [
    {
      chunk_id: 1,
      time_range: "0.0s - 10.0s",
      transcript:
        "Machine learning is a branch of artificial intelligence that helps systems learn from data.",
      visual_summary: "light movement",
      semantic_similarity: 0.78,
      keyword_coverage: 0.64,
      filler_ratio: 0.02,
      visual_activity: 0.32,
      chunk_score_10: 7.31,
    },
    {
      chunk_id: 2,
      time_range: "10.0s - 20.0s",
      transcript:
        "It can make predictions and decisions without explicit programming for every case.",
      visual_summary: "mostly static",
      semantic_similarity: 0.71,
      keyword_coverage: 0.58,
      filler_ratio: 0.01,
      visual_activity: 0.18,
      chunk_score_10: 6.83,
    },
    {
      chunk_id: 3,
      time_range: "20.0s - 30.0s",
      transcript:
        "There are supervised, unsupervised and reinforcement learning approaches.",
      visual_summary: "moderate activity",
      semantic_similarity: 0.82,
      keyword_coverage: 0.72,
      filler_ratio: 0.0,
      visual_activity: 0.44,
      chunk_score_10: 7.96,
    },
  ],
  final_score: {
    overall_semantic_similarity: 0.77,
    overall_keyword_coverage: 0.65,
    overall_visual_activity: 0.31,
    overall_filler_ratio: 0.01,
    overall_score_10: 7.37,
    overall_score_100: 73.7,
  },
};

function scoreLabel(score) {
  if (score >= 8.5) return "Excellent";
  if (score >= 7) return "Good";
  if (score >= 5.5) return "Average";
  return "Needs improvement";
}

function percent(v) {
  return Math.round((Number(v || 0) * 100 + Number.EPSILON) * 10) / 10;
}

function parseJsonSafely(text) {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export default function EvaluationDashboard() {
  const [data, setData] = useState(sampleData);
  const [rawText, setRawText] = useState(JSON.stringify(sampleData, null, 2));
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const timeline = useMemo(() => {
    const rows = data?.structured_timeline || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((item) => {
      const text =
        `${item.time_range} ${item.transcript} ${item.visual_summary}`.toLowerCase();
      return text.includes(q);
    });
  }, [data, search]);

  const finalScore = data?.final_score?.overall_score_10 || 0;
  const summary = data?.final_score || {};

  const handleApplyJson = () => {
    const parsed = parseJsonSafely(rawText);
    if (!parsed.ok) {
      setError(`Invalid JSON: ${parsed.error}`);
      return;
    }
    setError("");
    setData(parsed.data);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setRawText(text);

    const parsed = parseJsonSafely(text);
    if (!parsed.ok) {
      setError(`Invalid JSON: ${parsed.error}`);
      return;
    }

    setError("");
    setData(parsed.data);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.hero}
        >
          <div style={styles.heroTop}>
            <div>
              <h1 style={styles.title}>AI Video Answer Evaluation Dashboard</h1>
              <p style={styles.subtitle}>
                Load <b>evaluation_result.json</b> and review transcript,
                chunk-level analysis, and final scoring.
              </p>
            </div>
            <div style={styles.scoreBadge}>
              {scoreLabel(finalScore)} · {finalScore.toFixed(2)}/10
            </div>
          </div>

          <div style={styles.uploadGrid}>
            <div style={styles.card}>
              <div style={styles.cardTitleRow}>
                <Upload size={18} />
                <h3 style={styles.cardTitle}>Load JSON</h3>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={styles.button}>
                  Upload evaluation_result.json
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </label>

                <button
                  style={styles.outlineButton}
                  onClick={() => {
                    setRawText(JSON.stringify(sampleData, null, 2));
                    setData(sampleData);
                    setError("");
                  }}
                >
                  Use sample data
                </button>
              </div>

              {error && (
                <div style={styles.errorBox}>
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardTitleRow}>
                <FileJson size={18} />
                <h3 style={styles.cardTitle}>Paste JSON</h3>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                style={styles.textarea}
              />

              <button style={styles.button} onClick={handleApplyJson}>
                Apply JSON
              </button>
            </div>
          </div>
        </motion.div>

        <div style={styles.metricGrid}>
          <MetricCard
            icon={<Gauge size={20} />}
            title="Overall Score"
            value={`${(summary.overall_score_10 || 0).toFixed(2)}/10`}
            sub={`${(summary.overall_score_100 || 0).toFixed(2)}/100`}
            progress={(summary.overall_score_10 || 0) * 10}
          />
          <MetricCard
            icon={<Mic size={20} />}
            title="Semantic Similarity"
            value={`${percent(summary.overall_semantic_similarity || 0)}%`}
            sub="Meaning match"
            progress={percent(summary.overall_semantic_similarity || 0)}
          />
          <MetricCard
            icon={<Search size={20} />}
            title="Keyword Coverage"
            value={`${percent(summary.overall_keyword_coverage || 0)}%`}
            sub="Reference term match"
            progress={percent(summary.overall_keyword_coverage || 0)}
          />
          <MetricCard
            icon={<Activity size={20} />}
            title="Filler Ratio"
            value={`${percent(summary.overall_filler_ratio || 0)}%`}
            sub="Lower is better"
            progress={Math.min(100, percent(summary.overall_filler_ratio || 0) * 2)}
          />
        </div>

        <div style={styles.mainGrid}>
          <div style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Chunk-wise Timeline Analysis</h2>
              <div style={styles.searchBox}>
                <Search size={16} color="#64748b" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chunk text or time..."
                  style={styles.searchInput}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {timeline.length === 0 ? (
                <div style={styles.emptyBox}>No chunks matched your search.</div>
              ) : (
                timeline.map((item, index) => (
                  <motion.div
                    key={`${item.chunk_id}-${item.time_range}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    style={styles.chunkCard}
                  >
                    <div style={styles.chunkTop}>
                      <div style={{ flex: 1 }}>
                        <div style={styles.chunkBadges}>
                          <span style={styles.miniBadge}>Chunk {item.chunk_id}</span>
                          <span style={styles.miniBadge}>
                            <Clock3 size={13} style={{ marginRight: 4 }} />
                            {item.time_range}
                          </span>
                          <span style={styles.miniBadge}>
                            {item.visual_summary}
                          </span>
                        </div>
                        <p style={styles.chunkText}>{item.transcript}</p>
                      </div>

                      <div style={styles.chunkScoreBox}>
                        <div style={styles.chunkScoreLabel}>Chunk Score</div>
                        <div style={styles.chunkScoreValue}>
                          {Number(item.chunk_score_10 || 0).toFixed(2)}
                        </div>
                        <div style={styles.chunkScoreLabel}>/ 10</div>
                      </div>
                    </div>

                    <div style={styles.miniMetricGrid}>
                      <MiniMetric
                        label="Semantic"
                        value={percent(item.semantic_similarity || 0)}
                      />
                      <MiniMetric
                        label="Keywords"
                        value={percent(item.keyword_coverage || 0)}
                      />
                      <MiniMetric
                        label="Filler"
                        value={percent(item.filler_ratio || 0)}
                      />
                      <MiniMetric
                        label="Visual"
                        value={percent(item.visual_activity || 0)}
                      />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div style={styles.sideColumn}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Full Transcript</h2>
              <div style={styles.transcriptBox}>
                {data?.full_transcript || "No transcript available."}
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Scoring Logic</h2>
              <div style={styles.logicBox}>
                <div><b>70%</b> semantic similarity</div>
                <div><b>20%</b> keyword coverage</div>
                <div><b>10%</b> visual activity</div>
                <div><b>−10%</b> filler penalty</div>
              </div>
              <p style={styles.logicText}>
                This dashboard visualizes your current pipeline output from
                <b> evaluation_result.json</b>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, sub, progress }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTop}>
        <div>
          <div style={styles.metricTitle}>{title}</div>
          <div style={styles.metricValue}>{value}</div>
          <div style={styles.metricSub}>{sub}</div>
        </div>
        <div style={styles.metricIcon}>{icon}</div>
      </div>
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${Math.max(0, Math.min(100, progress || 0))}%`,
          }}
        />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  const shown = Math.max(0, Math.min(100, value || 0));

  return (
    <div style={styles.miniMetric}>
      <div style={styles.miniMetricLabel}>{label}</div>
      <div style={styles.miniMetricValue}>{shown}%</div>
      <div style={styles.progressTrackSmall}>
        <div
          style={{
            ...styles.progressFill,
            width: `${shown}%`,
          }}
        />
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: "1280px",
    margin: "0 auto",
    display: "grid",
    gap: "24px",
  },
  hero: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.1,
    color: "#0f172a",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: "14px",
  },
  scoreBadge: {
    background: "#e2e8f0",
    color: "#0f172a",
    padding: "10px 14px",
    borderRadius: "14px",
    fontWeight: 600,
    fontSize: "14px",
  },
  uploadGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.05)",
    border: "1px solid #e2e8f0",
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "14px",
    color: "#0f172a",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
  },
  button: {
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButton: {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
  },
  textarea: {
    width: "100%",
    minHeight: "180px",
    borderRadius: "16px",
    border: "1px solid #cbd5e1",
    padding: "12px",
    fontFamily: "monospace",
    fontSize: "12px",
    marginBottom: "12px",
    outline: "none",
    resize: "vertical",
  },
  errorBox: {
    marginTop: "12px",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "12px",
    borderRadius: "14px",
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    fontSize: "14px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  metricCard: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "20px",
    boxShadow: "0 8px 30px rgba(15, 23, 42, 0.05)",
    border: "1px solid #e2e8f0",
  },
  metricTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  metricTitle: {
    color: "#64748b",
    fontSize: "14px",
  },
  metricValue: {
    color: "#0f172a",
    fontSize: "28px",
    fontWeight: 700,
    marginTop: "8px",
  },
  metricSub: {
    color: "#64748b",
    fontSize: "13px",
    marginTop: "4px",
  },
  metricIcon: {
    background: "#e2e8f0",
    color: "#334155",
    borderRadius: "16px",
    padding: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    marginTop: "16px",
    width: "100%",
    height: "10px",
    background: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressTrackSmall: {
    marginTop: "8px",
    width: "100%",
    height: "8px",
    background: "#e2e8f0",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#0f172a",
    borderRadius: "999px",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.8fr)",
    gap: "24px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    color: "#0f172a",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "10px 12px",
    minWidth: "260px",
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontSize: "14px",
  },
  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: "16px",
    padding: "32px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "14px",
  },
  chunkCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "16px",
    background: "#ffffff",
  },
  chunkTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  chunkBadges: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "10px",
  },
  miniBadge: {
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    display: "inline-flex",
    alignItems: "center",
  },
  chunkText: {
    margin: 0,
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  chunkScoreBox: {
    minWidth: "110px",
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "12px",
    textAlign: "center",
  },
  chunkScoreLabel: {
    color: "#64748b",
    fontSize: "12px",
  },
  chunkScoreValue: {
    color: "#0f172a",
    fontWeight: 700,
    fontSize: "26px",
    margin: "4px 0",
  },
  miniMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "12px",
    marginTop: "14px",
  },
  miniMetric: {
    background: "#f8fafc",
    borderRadius: "14px",
    padding: "12px",
  },
  miniMetricLabel: {
    fontSize: "12px",
    color: "#64748b",
  },
  miniMetricValue: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#0f172a",
    marginTop: "4px",
  },
  sideColumn: {
    display: "grid",
    gap: "24px",
    alignContent: "start",
  },
  transcriptBox: {
    maxHeight: "320px",
    overflow: "auto",
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "16px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.8,
    marginTop: "14px",
  },
  logicBox: {
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "16px",
    color: "#334155",
    lineHeight: 1.8,
    marginTop: "14px",
  },
  logicText: {
    color: "#64748b",
    fontSize: "14px",
    marginTop: "12px",
  },
};