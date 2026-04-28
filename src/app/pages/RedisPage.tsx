import { useState } from 'react';
import { Server, Database, Activity, Copy, Trash2, RefreshCw } from 'lucide-react';
import { TopBar } from '../components/TopBar';

type KeyType = 'string' | 'list' | 'hash' | 'set' | 'zset' | 'stream';

interface RedisKey {
  name: string;
  type: KeyType;
  ttl: number | null;
  group: string;
}

interface StreamMessage {
  id: string;
  timestamp: string;
  payload: any;
}

const redisKeys: RedisKey[] = [
  { name: 'img_cache:f2d3a8c9b1e4567f', type: 'hash', ttl: 3600, group: 'Image Cache' },
  { name: 'img_cache:a7b2c5d8e3f1234g', type: 'hash', ttl: 2400, group: 'Image Cache' },
  { name: 'img_cache:c8d9e4f5a1b2678h', type: 'hash', ttl: 1800, group: 'Image Cache' },
  { name: 'rate_limit:ep_192.168.1.45:1423', type: 'string', ttl: 58, group: 'Rate Limit' },
  { name: 'rate_limit:ep_192.168.1.89:1419', type: 'string', ttl: 42, group: 'Rate Limit' },
  { name: 'rate_limit:ep_192.168.1.23:1415', type: 'string', ttl: 35, group: 'Rate Limit' },
  { name: 'stream:db_ingest', type: 'stream', ttl: null, group: 'Streams' },
  { name: 'stream:system_audit', type: 'stream', ttl: null, group: 'Streams' },
];

const keyValues: Record<string, any> = {
  'img_cache:f2d3a8c9b1e4567f': {
    score: 94.2,
    status: 'malicious',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_f2d3a8c9.jpg'
  },
  'img_cache:a7b2c5d8e3f1234g': {
    score: 68.5,
    status: 'suspicious',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_a7b2c5d8.png'
  },
  'img_cache:c8d9e4f5a1b2678h': {
    score: 23.1,
    status: 'benign',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_c8d9e4f5.jpg'
  },
  'rate_limit:ep_192.168.1.45:1423': '47',
  'rate_limit:ep_192.168.1.89:1419': '23',
  'rate_limit:ep_192.168.1.23:1415': '15',
  'stream:db_ingest': [
    {
      id: '1714323845000-0',
      timestamp: '2024-04-28 14:23:45',
      payload: {
        event_type: 'image_extracted',
        sha256_hash: 'f2d3a8c9b1e4567f',
        endpoint_id: 'ep_192.168.1.45'
      }
    },
    {
      id: '1714323842000-0',
      timestamp: '2024-04-28 14:23:42',
      payload: {
        event_type: 'inference_completed',
        sha256_hash: 'f2d3a8c9b1e4567f',
        calpa_score: 94.2
      }
    },
    {
      id: '1714323838000-0',
      timestamp: '2024-04-28 14:23:38',
      payload: {
        event_type: 'alert_raised',
        endpoint_id: 'ep_192.168.1.45',
        severity: 'critical'
      }
    },
  ],
  'stream:system_audit': [
    {
      id: '1714323845000-0',
      timestamp: '2024-04-28 14:23:45',
      payload: {
        component: 'proxy',
        action: 'image_extracted',
        session_id: 'sess_a7f3e9b2'
      }
    },
    {
      id: '1714323842000-0',
      timestamp: '2024-04-28 14:23:42',
      payload: {
        component: 'model-service',
        action: 'inference_completed',
        confidence: 'HIGH'
      }
    },
  ],
};

const formatTTL = (ttl: number | null): string => {
  if (ttl === null) return 'No expiry';
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  const hours = Math.floor(ttl / 3600);
  const minutes = Math.floor((ttl % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export function RedisPage() {
  const [selectedKey, setSelectedKey] = useState<string>('img_cache:f2d3a8c9b1e4567f');
  const [loading, setLoading] = useState(false);

  const selectedKeyData = redisKeys.find(k => k.name === selectedKey);
  const selectedValue = keyValues[selectedKey];

  const streamKeys = redisKeys.filter(k => k.type === 'stream');

  const handleKeySelect = (keyName: string) => {
    setLoading(true);
    setSelectedKey(keyName);
    setTimeout(() => setLoading(false), 200);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedValue, null, 2));
  };

  const renderValue = () => {
    if (loading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />
          ))}
        </div>
      );
    }

    if (!selectedKeyData || !selectedValue) {
      return <div style={{ color: 'var(--text-muted)' }}>No value</div>;
    }

    switch (selectedKeyData.type) {
      case 'string':
        return (
          <div
            className="p-3 rounded-lg"
            style={{
              background: 'var(--bg-sidebar)',
              fontFamily: 'monospace',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              wordBreak: 'break-all'
            }}
          >
            {selectedValue}
          </div>
        );

      case 'hash':
        return (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Field
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(selectedValue).map(([field, value], index) => (
                <tr key={field} style={{ background: index % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {field}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                    {String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'list':
        return (
          <div className="space-y-1">
            {selectedValue.map((item: string, index: number) => (
              <div
                key={index}
                className="p-2 rounded"
                style={{
                  background: 'var(--bg-sidebar)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace'
                }}
              >
                [{index}] {item}
              </div>
            ))}
          </div>
        );

      case 'set':
        return (
          <div className="space-y-1">
            {selectedValue.map((item: string, index: number) => (
              <div
                key={index}
                className="p-2 rounded"
                style={{
                  background: 'var(--bg-sidebar)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace'
                }}
              >
                {item}
              </div>
            ))}
          </div>
        );

      case 'zset':
        return (
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Score
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Member
                </th>
              </tr>
            </thead>
            <tbody>
              {selectedValue.map((item: any, index: number) => (
                <tr key={index} style={{ background: index % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'right', fontFamily: 'monospace' }}>
                    {item.score}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {item.member}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'stream':
        return (
          <div className="space-y-2">
            {selectedValue.map((msg: StreamMessage, index: number) => (
              <div
                key={msg.id}
                className="p-3 rounded-lg"
                style={{
                  background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    ID: {msg.id}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {msg.timestamp}
                  </span>
                </div>
                <pre
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-primary)',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {JSON.stringify(msg.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Redis Monitor" />

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              className="p-4 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Keys
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {redisKeys.length.toLocaleString()}
              </div>
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Memory Usage
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                247 MB
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                of 512 MB (48%)
              </div>
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Connections
                </span>
              </div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                47
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className="rounded-lg border flex flex-col"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                height: '520px'
              }}
            >
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Keys ({redisKeys.length})
                </h3>
                <button className="p-1.5 rounded hover:bg-opacity-70 transition-colors" style={{ background: 'var(--bg-sidebar)' }}>
                  <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-2">
                {['Image Cache', 'Rate Limit', 'Streams'].map((group) => {
                  const groupKeys = redisKeys.filter(k => k.group === group);
                  if (groupKeys.length === 0) return null;

                  return (
                    <div key={group} className="mb-4">
                      <div
                        className="px-2 py-1 mb-1"
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.05em'
                        }}
                      >
                        {group}
                      </div>
                      {groupKeys.map((key) => (
                        <button
                          key={key.name}
                          onClick={() => handleKeySelect(key.name)}
                          className="w-full text-left p-3 rounded-lg mb-1 transition-all redis-key-item"
                          style={{
                            background: selectedKey === key.name ? 'var(--bg-hover)' : 'transparent',
                            border: selectedKey === key.name ? '1px solid var(--accent)' : '1px solid transparent'
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              style={{
                                fontSize: 'var(--text-sm)',
                                fontFamily: 'monospace',
                                color: selectedKey === key.name ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: selectedKey === key.name ? 500 : 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '150px'
                              }}
                            >
                              {key.name.split(':').slice(1).join(':')}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded"
                              style={{
                                background: 'var(--bg-sidebar)',
                                color: 'var(--accent)',
                                fontSize: 'var(--text-xs)',
                                fontFamily: 'monospace'
                              }}
                            >
                              {key.type}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            TTL: {formatTTL(key.ttl)}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-lg border flex flex-col"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                height: '520px'
              }}
            >
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Value Viewer
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded hover:bg-opacity-70 transition-colors"
                    style={{ background: 'var(--bg-sidebar)' }}
                    title="Copy value"
                  >
                    <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    className="p-1.5 rounded hover:bg-opacity-70 transition-colors"
                    style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                    title="Delete key"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--status-error)' }} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="space-y-4">
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Key
                    </div>
                    <div
                      className="p-2 rounded"
                      style={{
                        background: 'var(--bg-sidebar)',
                        fontFamily: 'monospace',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        wordBreak: 'break-all'
                      }}
                    >
                      {selectedKey}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Type
                    </div>
                    <div
                      className="p-2 rounded inline-block"
                      style={{
                        background: 'var(--bg-sidebar)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--accent)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {selectedKeyData?.type}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      TTL
                    </div>
                    <div
                      className="p-2 rounded inline-block"
                      style={{
                        background: 'var(--bg-sidebar)',
                        fontSize: 'var(--text-sm)',
                        color: selectedKeyData?.ttl === null ? 'var(--status-success)' : 'var(--text-primary)'
                      }}
                    >
                      {formatTTL(selectedKeyData?.ttl || null)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Value
                    </div>
                    <div>
                      {renderValue()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {streamKeys.length > 0 && (
            <div
              className="rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Stream Messages
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {selectedKeyData?.type === 'stream' ? `Showing messages from ${selectedKey}` : 'Select a stream key to view messages'}
                </p>
              </div>

              {selectedKeyData?.type === 'stream' ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Message ID
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Timestamp
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Payload
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedValue as StreamMessage[]).map((msg, index) => (
                        <tr
                          key={msg.id}
                          style={{
                            background: index % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)',
                            borderBottom: '1px solid var(--border-subtle)'
                          }}
                        >
                          <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {msg.id}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                            {msg.timestamp}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                            <code
                              style={{
                                background: 'var(--bg-sidebar)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: 'var(--text-xs)',
                                fontFamily: 'monospace'
                              }}
                            >
                              {JSON.stringify(msg.payload)}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Select a stream key to view messages
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .redis-key-item:hover {
          background: var(--bg-hover) !important;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
