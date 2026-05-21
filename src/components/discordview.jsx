import React, { useState, useEffect } from 'react';
import Embed from './embed';
import { parse, parseAllowLinks, jumboify } from './markdown';
import { discordBtnBase, discordBtnClass } from '../lib/styles';

const shortTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: 'numeric' });

// Discord-style "Today at 2:30 PM" / "Yesterday at 2:30 PM" / "M/D/YYYY"
function formatCalendar(date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const time = shortTime.format(date);
  if (date >= startOfToday && date < startOfTomorrow) return `Today at ${time}`;
  if (date >= startOfYesterday && date < startOfToday) return `Yesterday at ${time}`;
  return date.toLocaleDateString();
}

function MessageTimestamp({ compactMode = false }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();
  const computed = compactMode ? shortTime.format(now) : formatCalendar(now);
  return <span className="timestamp">{computed}</span>;
}

function MessageBody({ compactMode, username, content, webhookMode }) {
  if (compactMode) {
    return (
      <div className="markup">
        <MessageTimestamp compactMode={compactMode} />
        <span className="username-wrapper v-btm">
          <strong className="user-name">{username}</strong>
          <span className="bot-tag">APP</span>
        </span>
        <span className="highlight-separator"> - </span>
        <span className="message-content">
          {content && parse(content, true, {}, jumboify)}
        </span>
      </div>
    );
  } else if (content) {
    if (webhookMode) {
      return (
        <div className="markup">
          {parseAllowLinks(content, true, {}, jumboify)}
        </div>
      );
    }
    return (
      <div className="markup">{parse(content, true, {}, jumboify)}</div>
    );
  }
  return null;
}

function CozyMessageHeader({ compactMode, username }) {
  if (compactMode) return null;
  return (
    <h2 style={{ lineHeight: '16px' }}>
      <span className="username-wrapper v-btm">
        <strong className="user-name">{username}</strong>
        <span className="bot-tag">APP</span>
      </span>
      <span className="highlight-separator"> - </span>
      <MessageTimestamp compactMode={compactMode} />
    </h2>
  );
}

function Avatar({ compactMode, url }) {
  if (compactMode) return null;
  return (
    <div
      className="avatar-large animate"
      style={{ backgroundImage: `url('${url}')` }}
    />
  );
}

function ErrorHeader({ error }) {
  if (!error) return null;
  return (
    <header className="f6 bg-red br2 pa2 br--top w-100 code pre-wrap">
      {error}
    </header>
  );
}

function DiscordViewWrapper({ darkTheme, children }) {
  return (
    <div className="w-100 h-100 overflow-auto pa2 discord-view">
      <div className={`flex-vertical whitney ${darkTheme ? 'theme-dark' : ''}`}>
        <div className="chat flex-vertical flex-spacer">
          <div className="content flex-spacer flex-horizontal">
            <div className="flex-spacer flex-vertical messages-wrapper">
              <div className="scroller-wrap">
                <div className="scroller messages">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscordActionRows({ buttons }) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(buttons.slice(i, i + 5));
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-wrap gap-1.5">
          {row.map((b) => (
            <span
              key={b.id}
              className={`${discordBtnBase} ${discordBtnClass[b.style] || discordBtnClass.secondary}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DiscordView({
  username = 'Poracle',
  avatar_url = 'https://cdn.discordapp.com/embed/avatars/0.png',
  darkTheme = true,
  compactMode = false,
  webhookMode = false,
  error = null,
  data = {},
}) {
  const { content, embed } = data;
  const embeds = Array.isArray(data.embeds) ? data.embeds : null;
  const bgColor = darkTheme ? 'bg-discord-dark' : 'bg-discord-light';
  const cls = `w-100 h-100 br2 flex flex-column white overflow-hidden ${bgColor}`;

  return (
    <div className={cls}>
      <ErrorHeader error={error} />
      <DiscordViewWrapper darkTheme={darkTheme}>
        <div
          className={`message-group hide-overflow ${compactMode ? 'compact' : ''}`}
        >
          <Avatar url={avatar_url} compactMode={compactMode} />
          <div className="comment">
            <div className="message first">
              <CozyMessageHeader
                username={username}
                compactMode={compactMode}
              />
              <div className="message-text">
                <MessageBody
                  content={content}
                  username={username}
                  compactMode={compactMode}
                  webhookMode={webhookMode}
                />
              </div>
              {embed ? (
                <Embed {...embed} />
              ) : (
                embeds &&
                embeds.map((e, i) => <Embed key={i} {...e} />)
              )}
              <DiscordActionRows buttons={data.__buttons} />
            </div>
          </div>
        </div>
      </DiscordViewWrapper>
    </div>
  );
}
