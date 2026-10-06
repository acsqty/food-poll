import { useEffect, useState, type FormEvent } from 'react'
import './App.css'

type SuggestionAuthor = { id: string; name: string }

type PollOption = {
  id: string
  name: string
  restaurant: string
  label: string
  votes: number
  suggestedBy: SuggestionAuthor | null
}

type PendingSuggestion = {
  id: string
  text: string
  suggestedBy: SuggestionAuthor
  initialVotes: number
}

type PollData = {
  poll: {
    id: string
    title: string
    status: 'open' | 'closed'
    closesAt: string
    shareUrl: string
    live: boolean
    totalVotes: number
    voterCount: number
    leadMargin: number
    options: PollOption[]
    pendingSuggestions: PendingSuggestion[]
    settings: { segmentsTotal: number; canEndEarly: boolean; canReopen: boolean }
  }
  users: { id: string; name: string; avatar: string }[]
}

function App() {
  const [data, setData] = useState<PollData | null>(null)
  const [myVote, setMyVote] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [newPollOpen, setNewPollOpen] = useState(false)
  const [pollTitle, setPollTitle] = useState('')
  const [pollOptions, setPollOptions] = useState('')

  useEffect(() => {
    fetch('/poll.json')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the poll')
        return response.json() as Promise<PollData>
      })
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) {
    return <main className="loading">Loading poll...</main>
  }

  const { poll } = data
  const options = [...poll.options].sort((first, second) => second.votes - first.votes)
  const totalVotes = options.reduce((total, option) => total + option.votes, 0)
  const leader = options[0]
  const runnerUp = options[1]
  const leadMargin = leader && runnerUp ? leader.votes - runnerUp.votes : 0
  const avatarFor = (userId: string) => data.users.find((user) => user.id === userId)
  const percentFor = (votes: number) => totalVotes ? Math.round((votes / totalVotes) * 100) : 0

  function castVote(optionId: string) {
    if (!data || poll.status !== 'open') return
    setData((current) => {
      if (!current) return current
      const hadVoted = myVote !== null
      return {
        ...current,
        poll: {
          ...current.poll,
          totalVotes: current.poll.totalVotes + (hadVoted ? 0 : 1),
          voterCount: current.poll.voterCount + (hadVoted ? 0 : 1),
          options: current.poll.options.map((option) => ({
            ...option,
            votes: option.votes + Number(option.id === optionId) - Number(option.id === myVote),
          })),
        },
      }
    })
    setMyVote(optionId)
  }

  function handleSuggestion(suggestion: PendingSuggestion, approve: boolean) {
    setData((current) => {
      if (!current) return current
      const pendingSuggestions = current.poll.pendingSuggestions.filter((item) => item.id !== suggestion.id)
      if (!approve) {
        return { ...current, poll: { ...current.poll, pendingSuggestions } }
      }
      const option: PollOption = {
        id: `option-${Date.now()}`,
        name: suggestion.text,
        restaurant: '',
        label: suggestion.text,
        votes: suggestion.initialVotes,
        suggestedBy: suggestion.suggestedBy,
      }
      return {
        ...current,
        poll: {
          ...current.poll,
          options: [...current.poll.options, option],
          pendingSuggestions,
        },
      }
    })
  }

  async function copyLink() {
    await navigator.clipboard.writeText(poll.shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const newOptions = pollOptions.split('\n').map((name) => name.trim()).filter(Boolean)
    if (!pollTitle.trim() || newOptions.length < 2) return
    const newPollId = `poll-${Date.now()}`
    setData((current) => current ? {
      ...current,
      poll: {
        ...current.poll,
        id: newPollId,
        shareUrl: `https://tiebreak.test/p/${newPollId}`,
        closesAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        title: pollTitle.trim(),
        status: 'open',
        totalVotes: 0,
        voterCount: 0,
        leadMargin: 0,
        options: newOptions.map((name, index) => ({
          id: `option-${Date.now()}-${index}`,
          name,
          restaurant: '',
          label: name,
          votes: 0,
          suggestedBy: null,
        })),
        pendingSuggestions: [],
      },
    } : current)
    setMyVote(null)
    setNewPollOpen(false)
    setPollTitle('')
    setPollOptions('')
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Tiebreak home"><span className="brand-mark">✓</span> tiebreak</a>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#poll">My polls</a>
          <a className="nav-link" href="#closed">Closed</a>
        </nav>
        <div className="top-actions">
          <button className="button button-outline new-poll-button" onClick={() => setNewPollOpen(true)}><span aria-hidden="true">+</span> New poll</button>
          <img className="profile-avatar" src="/avatars/rabbit.png" alt="Your profile" />
        </div>
      </header>

      <main id="poll" className="poll-shell">
        <div className="poll-meta">
          <span className={`status-pill ${poll.status === 'open' ? 'status-open' : 'status-closed'}`}>
            <span className="status-dot" />{poll.status === 'open' ? 'Voting open' : 'Voting closed'}
          </span>
          <span className="deadline-pill"><span aria-hidden="true">◷</span> Closes today at <strong>{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Budapest' }).format(new Date(poll.closesAt))}</strong></span>
        </div>

        <h1>{poll.title}</h1>

        <div className="voter-summary">
          <div className="avatar-stack" aria-hidden="true">
            {data.users.slice(0, 3).map((user) => <img key={user.id} src={user.avatar} alt="" />)}
          </div>
          <span><strong>{poll.voterCount} of your crew</strong> voted <span className="summary-separator">·</span> last one 2 min ago</span>
        </div>

        <section className="results" aria-label="Poll results">
          {leader && leader.votes > 0 && (() => {
            const author = leader.suggestedBy && avatarFor(leader.suggestedBy.id)
            const label = leader.restaurant ? `${leader.name} from ${leader.restaurant}` : leader.label
            return <button
              type="button"
              className={`leader-option ${myVote === leader.id ? 'voted-option' : ''}`}
              onClick={() => castVote(leader.id)}
              disabled={poll.status !== 'open'}
              aria-label={`Vote for ${label}, currently ${percentFor(leader.votes)} percent`}
            >
              <span className="lead-ribbon">IN THE LEAD</span>
              <span className="leader-title">{label}</span>
              {author && <span className="suggested-by leader-suggestion"><img src={author.avatar} alt="" /> Suggested by {author.name}</span>}
              <span className="leader-stats"><strong>{percentFor(leader.votes)}<small>%</small></strong><span className="vote-count-pill">{leader.votes} of {totalVotes} votes <span>·</span> ahead by {leadMargin}</span></span>
              <span className="vote-segments" style={{ gridTemplateColumns: `repeat(${poll.settings.segmentsTotal}, minmax(0, 1fr))` }} aria-hidden="true">
                {Array.from({ length: poll.settings.segmentsTotal }, (_, segment) => <span key={segment} className={segment < leader.votes ? 'filled' : ''} />)}
              </span>
              {myVote === leader.id && <span className="your-vote">YOUR VOTE</span>}
            </button>
          })()}
          <div className="result-list">
            {options.filter((option) => option.id !== leader?.id || leader.votes === 0).map((option) => {
              const percent = percentFor(option.votes)
              const author = option.suggestedBy && avatarFor(option.suggestedBy.id)
              const label = option.restaurant ? `${option.name} from ${option.restaurant}` : option.label
              return <button
                type="button"
                className={`result-row ${myVote === option.id ? 'voted-option' : ''}`}
                key={option.id}
                onClick={() => castVote(option.id)}
                disabled={poll.status !== 'open'}
                aria-label={`Vote for ${label}, currently ${percent} percent`}
              >
                <span className="option-info"><strong>{label}</strong>{author && <span className="suggested-by"><img src={author.avatar} alt="" /> Suggested by {author.name}</span>}</span>
                <span className="progress-track"><span className="progress-fill" style={{ width: `${percent}%` }} /></span>
                <span className="row-stat"><strong>{percent}%</strong><small>{option.votes} {option.votes === 1 ? 'vote' : 'votes'}</small></span>
                {myVote === option.id && <span className="your-vote">YOUR VOTE</span>}
              </button>
            })}
          </div>
        </section>

        <div className="result-footnote">
          <strong>{totalVotes} votes in <span>—</span> <em>{poll.status === 'open' ? 'still anyone’s game' : 'voting has ended'}</em></strong>
          <span className="live-indicator"><span /> {poll.live && poll.status === 'open' ? 'Live — updates as votes land' : 'Results updated'}</span>
        </div>

        {poll.pendingSuggestions.map((suggestion) => {
          const author = avatarFor(suggestion.suggestedBy.id)
          return <section className="suggestion-card" key={suggestion.id} aria-label="Pending suggestion">
            {author && <img className="suggestion-avatar" src={author.avatar} alt={`${author.name}`} />}
            <div className="suggestion-copy"><strong>{suggestion.suggestedBy.name} suggested: “{suggestion.text}”</strong><span>Approve it and it joins with {suggestion.initialVotes} votes — your call, house rules</span></div>
            <div className="suggestion-actions"><button className="button button-teal" onClick={() => handleSuggestion(suggestion, true)}>Add it</button><button className="text-button" onClick={() => handleSuggestion(suggestion, false)}>Not this time</button></div>
          </section>
        })}

        <div className="share-bar">
          <span className="share-label">Anyone with the link can vote:</span>
          <strong className="share-url">{poll.shareUrl.replace('https://', '')}</strong>
          <div className="share-actions">
            {poll.status === 'open' && poll.settings.canEndEarly
              ? <button className="button button-outline" onClick={() => setData((current) => current ? { ...current, poll: { ...current.poll, status: 'closed' } } : current)}>End voting</button>
              : poll.settings.canReopen && <button className="button button-outline" onClick={() => setData((current) => current ? { ...current, poll: { ...current.poll, status: 'open' } } : current)}>Reopen</button>}
            <button className="button button-dark" onClick={copyLink}><span aria-hidden="true">▣</span> {copied ? 'Copied!' : 'Copy link'}</button>
          </div>
        </div>
        <p className="closing-note">Ending early isn’t final — you can reopen voting later if the crew<br className="desktop-break" /> changes its mind.</p>
      </main>

      {newPollOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewPollOpen(false) }}>
        <form className="new-poll-modal" role="dialog" aria-modal="true" aria-labelledby="new-poll-title" onSubmit={createPoll}>
          <button type="button" className="modal-close" aria-label="Close" onClick={() => setNewPollOpen(false)}>×</button>
          <span className="eyebrow">A fresh round</span>
          <h2 id="new-poll-title">Start a new poll</h2>
          <label>What are we deciding?<input autoFocus value={pollTitle} onChange={(event) => setPollTitle(event.target.value)} required placeholder="e.g. Friday dinner" /></label>
          <label>Options <span className="field-hint">One option per line</span><textarea value={pollOptions} onChange={(event) => setPollOptions(event.target.value)} required rows={4} placeholder={'Tacos\nSushi\nPizza'} /></label>
          <button className="button button-teal modal-submit" type="submit">Create poll</button>
        </form>
      </div>}
    </>
  )
}

export default App
