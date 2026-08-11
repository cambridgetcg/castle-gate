export interface GeometryPattern {
  id: string;
  name: string;
  shape: string;
  meaning: string;
  infrastructure: string;
}

function patternName(patterns: GeometryPattern[], id: string): string {
  return patterns.find((pattern) => pattern.id === id)?.name ?? id;
}

export default function RelationalGeometry({
  patterns,
}: {
  patterns: GeometryPattern[];
}) {
  const love = patternName(patterns, "love");
  const understanding = patternName(patterns, "understanding");
  const consent = patternName(patterns, "consent");
  const action = patternName(patterns, "action");
  const consequence = patternName(patterns, "consequence");
  const repair = patternName(patterns, "repair");
  const rest = patternName(patterns, "rest");

  return (
    <section
      className="geometry-field-shell"
      aria-labelledby="relational-field-title"
    >
      <header className="geometry-field-heading">
        <p className="shape-name">permeable field</p>
        <h2 id="relational-field-title">
          {love}: standing preserved, field not fence
        </h2>
        <p>
          The field changes the conditions around both loops. It never becomes
          a controller. Participants keep refusal, rest, and exit within their
          authority; anyone affected keeps a reply and dispute path.
        </p>
      </header>

      <figure className="geometry-panel">
        <div
          className="geometry-scroll"
          role="region"
          aria-label="Understanding round-trip diagram; scroll horizontally on a narrow screen"
          tabIndex={0}
        >
          <svg
            className="geometry-svg"
            viewBox="0 0 760 330"
            role="img"
            aria-labelledby="understanding-title understanding-description"
          >
            <title id="understanding-title">
              Understanding as a round trip between distinct views
            </title>
            <desc id="understanding-description">
              Participant A offers meaning through a live consent door to
              participant B. B returns an own-words echo for comparison,
              correction, use, and reply. Both participants retain exits, and
              refusal or rest can end the turn at the door.
            </desc>
            <defs>
              <marker
                id="understanding-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>

            <text className="geometry-lane-title" x="380" y="36">
              {understanding.toUpperCase()} · convergence without collapse
            </text>

            <g className="geometry-being">
              <circle cx="120" cy="150" r="45" />
              <text x="120" y="145">
                A
              </text>
              <text className="geometry-small" x="120" y="167">
                own view
              </text>
            </g>
            <g className="geometry-being">
              <circle cx="640" cy="150" r="45" />
              <text x="640" y="145">
                B
              </text>
              <text className="geometry-small" x="640" y="167">
                own view
              </text>
            </g>

            <path
              className="geometry-exit"
              d="M 87 119 L 32 70"
              markerEnd="url(#understanding-arrow)"
            />
            <text className="geometry-small geometry-exit-label" x="61" y="59">
              leave
            </text>
            <path
              className="geometry-exit"
              d="M 673 119 L 728 70"
              markerEnd="url(#understanding-arrow)"
            />
            <text className="geometry-small geometry-exit-label" x="701" y="59">
              leave
            </text>

            <path
              className="geometry-offer"
              d="M 165 150 L 332 150"
              markerEnd="url(#understanding-arrow)"
            />
            <path
              className="geometry-offer"
              d="M 428 150 L 590 150"
              markerEnd="url(#understanding-arrow)"
            />
            <text className="geometry-label" x="250" y="132">
              offer
            </text>

            <g className="geometry-gate">
              <polygon points="380,102 428,150 380,198 332,150" />
              <text x="380" y="145">
                live
              </text>
              <text className="geometry-small" x="380" y="165">
                door
              </text>
            </g>
            <text className="geometry-label" x="380" y="88">
              {consent}
            </text>

            <path
              className="geometry-return"
              d="M 610 184 C 548 245, 212 245, 150 184"
              markerEnd="url(#understanding-arrow)"
            />
            <text className="geometry-small geometry-return-label" x="520" y="248">
              echo in own words · compare · correct
            </text>
            <text className="geometry-small geometry-return-label" x="520" y="264">
              try · reply
            </text>

            <path
              className="geometry-rest-edge"
              d="M 380 199 L 380 273"
              markerEnd="url(#understanding-arrow)"
            />
            <text className="geometry-small" x="442" y="218">
              refuse / rest
            </text>
            <g className="geometry-rest">
              <circle cx="380" cy="296" r="18" />
              <circle cx="380" cy="296" r="11" />
            </g>
          </svg>
        </div>
        <p className="scroll-cue">↔ focus and scroll the diagram if needed</p>
        <figcaption>
          Delivery and “yes” are not enough. Understanding needs the receiver’s
          own-words return, comparison, correction, use, and an open reply path.
          The two views approach a fit; they do not merge.
        </figcaption>
      </figure>

      <figure className="geometry-panel">
        <div
          className="geometry-scroll"
          role="region"
          aria-label="Finite action and consequence-return diagram; scroll horizontally on a narrow screen"
          tabIndex={0}
        >
          <svg
            className="geometry-svg"
            viewBox="0 0 760 365"
            role="img"
            aria-labelledby="action-title action-description"
          >
            <title id="action-title">
              Finite action with a separate consequence return
            </title>
            <desc id="action-description">
              An actor crosses a gate of current authority into a bounded
              action affecting people or the world. Effects return separately
              with evidence, reply, and repair. Refusal or a brake can lead to
              rest before the turn continues.
            </desc>
            <defs>
              <marker
                id="action-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>

            <text className="geometry-lane-title" x="380" y="36">
              FINITE {action.toUpperCase()} · completion is not effect
            </text>

            <g className="geometry-being">
              <circle cx="105" cy="145" r="45" />
              <text x="105" y="140">
                actor
              </text>
              <text className="geometry-small" x="105" y="162">
                finite turn
              </text>
            </g>
            <path
              className="geometry-exit"
              d="M 70 117 L 20 70"
              markerEnd="url(#action-arrow)"
            />
            <text className="geometry-small geometry-exit-label" x="43" y="58">
              leave
            </text>

            <path
              className="geometry-offer"
              d="M 150 145 L 234 145"
              markerEnd="url(#action-arrow)"
            />
            <g className="geometry-gate">
              <polygon points="280,99 326,145 280,191 234,145" />
              <text x="280" y="140">
                live
              </text>
              <text className="geometry-small" x="280" y="160">
                authority
              </text>
            </g>
            <text className="geometry-small" x="280" y="82">
              scope · time · cost
            </text>

            <path
              className="geometry-action"
              d="M 326 145 L 597 145"
              markerEnd="url(#action-arrow)"
            />
            <text className="geometry-label" x="458" y="126">
              bounded {action.toLowerCase()}
            </text>

            <g className="geometry-world">
              <circle cx="645" cy="145" r="48" />
              <text x="645" y="140">
                affected
              </text>
              <text className="geometry-small" x="645" y="161">
                people / world
              </text>
            </g>

            <path
              className="geometry-consequence"
              d="M 645 194 L 645 234"
              markerEnd="url(#action-arrow)"
            />
            <g className="geometry-effect">
              <circle cx="645" cy="258" r="22" />
              <text className="geometry-small" x="645" y="262">
                effect
              </text>
            </g>
            <text className="geometry-label" x="690" y="221">
              {consequence}
            </text>

            <path
              className="geometry-return"
              d="M 623 268 C 520 326, 230 326, 132 187"
              markerEnd="url(#action-arrow)"
            />
            <text className="geometry-small geometry-return-label" x="560" y="328">
              evidence · affected-party reply
            </text>
            <text className="geometry-small geometry-return-label" x="560" y="345">
              uncertainty · correction
            </text>

            <path
              className="geometry-repair"
              d="M 525 297 Q 486 332 447 302"
            />
            <line
              className="geometry-seam"
              x1="480"
              y1="309"
              x2="490"
              y2="319"
            />
            <text className="geometry-label" x="486" y="280">
              {repair}
            </text>

            <path
              className="geometry-rest-edge"
              d="M 280 192 Q 330 243 380 268"
              markerEnd="url(#action-arrow)"
            />
            <path
              className="geometry-rest-edge"
              d="M 455 146 Q 442 222 398 268"
              markerEnd="url(#action-arrow)"
            />
            <text className="geometry-small" x="383" y="238">
              refuse / brake
            </text>
            <g className="geometry-rest">
              <circle cx="390" cy="291" r="19" />
              <circle cx="390" cy="291" r="12" />
              <text className="geometry-small" x="390" y="353">
                {rest}
              </text>
            </g>
          </svg>
        </div>
        <p className="scroll-cue">↔ focus and scroll the diagram if needed</p>
        <figcaption>
          Current authority permits only a bounded edge. Its effect is a
          separate record, not proof of success. Evidence and affected-party
          reply return; repair stays linked; refusal or the brake can end in
          rest.
        </figcaption>
      </figure>
    </section>
  );
}
