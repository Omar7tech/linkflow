"use client";

import * as React from "react";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CommandIcon,
  MenuIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GeneratorLayout } from "@/components/shared/generator-layout";
import { TOOL_BY_ID } from "@/constants/tools";
import { cn } from "@/lib/utils";
import { ATTACK_CATEGORIES, ATTACKS, type Attack, type AttackCategory } from "./attack-data";
import { AttackWorkbench } from "./workbenches";
import styles from "./cyber-lab.module.css";

export function CyberLabTool() {
  const [selectedId, setSelectedId] = React.useState("sql-injection");
  const [category, setCategory] = React.useState<AttackCategory | "All">("All");
  const [query, setQuery] = React.useState("");
  const [completed, setCompleted] = React.useState<string[]>([]);
  const [mobileNav, setMobileNav] = React.useState(false);
  const attack = ATTACKS.find((item) => item.id === selectedId) ?? ATTACKS[0];
  const visible = ATTACKS.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const haystack = `${item.title} ${item.category} ${item.tags.join(" ")}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  });
  const attackIndex = ATTACKS.findIndex((item) => item.id === attack.id);

  const selectAttack = (item: Attack) => {
    setSelectedId(item.id);
    setMobileNav(false);
  };

  const move = (direction: -1 | 1) => {
    const next = (attackIndex + direction + ATTACKS.length) % ATTACKS.length;
    selectAttack(ATTACKS[next]);
  };

  const toggleComplete = () => {
    setCompleted((current) =>
      current.includes(attack.id)
        ? current.filter((id) => id !== attack.id)
        : [...current, attack.id]
    );
  };

  return (
    <GeneratorLayout tool={TOOL_BY_ID.cyberlab} output={null} fullBleed>
      <div className={styles.rangeFrame}>
        <div className={styles.rangeTopbar}>
          <div className={styles.productMark}>
            <CommandIcon aria-hidden />
            <span>RANGE/31</span>
            <em>LOCAL SIMULATION</em>
          </div>
          <div className={styles.coverage}>
            <span><b>{ATTACKS.length}</b> exercises</span>
            <span><b>{completed.length}</b> cleared</span>
            <span><b>0</b> network calls</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setMobileNav(true)} className={styles.mobileMenu}>
            <MenuIcon data-icon="inline-start" /> Exercises
          </Button>
        </div>

        <div className={styles.rangeBody}>
          <AttackNavigator
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            visible={visible}
            selectedId={selectedId}
            completed={completed}
            onSelect={selectAttack}
            open={mobileNav}
            onClose={() => setMobileNav(false)}
          />

          <main className={styles.stage}>
            <header className={styles.scenarioHeader}>
              <div className={styles.scenarioIdentity}>
                <span className={styles.exerciseNumber}>EXERCISE {String(attackIndex + 1).padStart(2, "0")}/{ATTACKS.length}</span>
                <div className={styles.titleRow}>
                  <attack.icon aria-hidden />
                  <h2>{attack.title}</h2>
                  <Badge variant="outline">{attack.difficulty}</Badge>
                </div>
                <p>{attack.mission}</p>
              </div>
              <div className={styles.scenarioControls}>
                <Button variant="outline" size="icon-sm" onClick={() => move(-1)} aria-label="Previous exercise"><ChevronLeftIcon /></Button>
                <Button variant="outline" size="icon-sm" onClick={() => move(1)} aria-label="Next exercise"><ChevronRightIcon /></Button>
                <Button variant={completed.includes(attack.id) ? "default" : "outline"} size="sm" onClick={toggleComplete}>
                  {completed.includes(attack.id) ? <CheckIcon data-icon="inline-start" /> : <BookOpenIcon data-icon="inline-start" />}
                  {completed.includes(attack.id) ? "Cleared" : "Mark cleared"}
                </Button>
              </div>
            </header>

            <div className={styles.operationStrip}>
              <div><span>DO</span><p>{attack.action}</p></div>
              <ChevronRightIcon aria-hidden />
              <div><span>WATCH</span><p>{attack.observe}</p></div>
              <ChevronRightIcon aria-hidden />
              <div><span>STOP</span><p>{attack.defense}</p></div>
            </div>

            <AttackWorkbench key={attack.id} attack={attack} />
          </main>
        </div>
      </div>
    </GeneratorLayout>
  );
}

type NavigatorProps = {
  query: string;
  setQuery: (value: string) => void;
  category: AttackCategory | "All";
  setCategory: (value: AttackCategory | "All") => void;
  visible: Attack[];
  selectedId: string;
  completed: string[];
  onSelect: (attack: Attack) => void;
  open: boolean;
  onClose: () => void;
};

function AttackNavigator(props: NavigatorProps) {
  return (
    <>
      {props.open && <button type="button" className={styles.navScrim} onClick={props.onClose} aria-label="Close exercises" />}
      <aside className={cn(styles.navigator, props.open && styles.navigatorOpen)}>
        <div className={styles.navigatorHead}>
          <div>
            <strong>EXERCISES</strong>
            <small>Choose one. Operate the system.</small>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={props.onClose} className={styles.closeNav} aria-label="Close exercises"><XIcon /></Button>
        </div>
        <div className={styles.searchBox}>
          <SearchIcon aria-hidden />
          <Input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search attacks" aria-label="Search exercises" />
        </div>
        <div className={styles.categoryRail} aria-label="Attack category">
          {["All", ...ATTACK_CATEGORIES].map((item) => (
            <button key={item} type="button" onClick={() => props.setCategory(item as AttackCategory | "All")} aria-pressed={props.category === item}>
              {item}
              <span>{item === "All" ? ATTACKS.length : ATTACKS.filter((attack) => attack.category === item).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.exerciseList}>
          {props.visible.map((item) => {
            const Icon = item.icon;
            const index = ATTACKS.findIndex((attack) => attack.id === item.id);
            const done = props.completed.includes(item.id);
            return (
              <button key={item.id} type="button" onClick={() => props.onSelect(item)} className={cn(styles.exerciseButton, props.selectedId === item.id && styles.exerciseButtonActive)}>
                <span className={styles.exerciseIndex}>{String(index + 1).padStart(2, "0")}</span>
                <Icon aria-hidden />
                <span><strong>{item.title}</strong><small>{item.category}</small></span>
                {done && <CheckIcon className={styles.doneIcon} aria-label="Cleared" />}
              </button>
            );
          })}
          {!props.visible.length && <div className={styles.noResults}>No exercise matches this filter.</div>}
        </div>
      </aside>
    </>
  );
}
