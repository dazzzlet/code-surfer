import { Tuple } from "./tuple";
import React, { CSSProperties } from "react";
import {
  enterLine,
  exitLine,
  StyleAnimation,
  emptyStyle,
  fadeInFocus,
  fadeOutFocus,
  unfocus
} from "./animation";
import { Styled } from "@code-surfer/themes";

export const parseSkipedRow = (lineIndex: number) => (rowPair: [number, number]) => {
  for (let i = rowPair[0]; i <= rowPair[1]; i++) {
    if (i == (lineIndex + 1)) {
      return true;
    }
  }
  return false;
}

type Step = {
  lines: number[];
  focus: Record<number, true | number[]>;
  skipRows: [number, number][];
};

type LineListProps = {
  stepPair: Tuple<Step>;
  t: number;
  tokens: string[][];
  types: string[][];
  dimensions?: { lineHeight: number };
  unfocusedStyle: { opacity: number };
  maxLineCount: number;
  showNumbers?: boolean;
};

export function LineList({
  stepPair,
  t,
  tokens,
  types,
  dimensions,
  unfocusedStyle,
  maxLineCount,
  showNumbers
}: LineListProps) {
  const lines = React.useMemo(() => {
    const linesPair = stepPair.selectMany((step: Step) =>
      step.lines.map((lineKey, lineIndex) => ({
        key: lineKey,
        lineNumber: lineIndex + 1,
        focus: step.focus[lineIndex],
        skipRows: step.skipRows.some(parseSkipedRow(lineIndex))
      })).map((linePair, lineIndex, linesPair) => ({
        ...linePair,
        isTransition: linePair.skipRows && (lineIndex == 0 || !linesPair[lineIndex - 1].skipRows)
      }))
    );

    const fadeInLines = linesPair
      .map((linePair, lineKey: number) => {
        const [prev] = linePair.spread();
        const [prevFocus, nextFocus] = linePair.select(l => l.focus).spread();
        const isFadeIn =
          !prev ||
          (!prevFocus && nextFocus) ||
          (nextFocus && Array.isArray(prevFocus));
        return isFadeIn ? lineKey : -1;
      })
      .filter(key => key !== -1);

    const fadeOutLines = linesPair
      .map((linePair, lineKey: number) => {
        const [, next] = linePair.spread();
        const [prevFocus, nextFocus] = linePair.select(l => l.focus).spread();
        const isFadeOut =
          !next ||
          (!nextFocus && prevFocus) ||
          (prevFocus && Array.isArray(nextFocus));
        return isFadeOut ? lineKey : -1;
      })
      .filter(key => key !== -1);

    return linesPair.map((lineTuple, lineKey) => {
      const offOpacity = unfocusedStyle.opacity;

      const [prevLine, nextLine] = lineTuple.spread();
      const [prevFocus, nextFocus] = lineTuple.select(l => l.focus).spread();
      const [prevSkipRows, nextSkipRows] = lineTuple.select(l => l.skipRows).spread();
      // const [prevIsTransition, nextIsTransition] = lineTuple.select(l => l.isTransition).spread();
      const isMoving = !prevLine || !nextLine;
      const isChangingFocus = prevFocus !== nextFocus;
      var isChangingSkipRows = prevSkipRows !== nextSkipRows;
      const isStatic = !isMoving && !isChangingFocus && !isChangingSkipRows;

      const areTokensAnimated =
        !isStatic && (Array.isArray(prevFocus) || Array.isArray(nextFocus));
      const areTokensStatic = !areTokensAnimated;

      const tokenElements =
        areTokensStatic &&
        tokens[lineKey].map((token, tokeni) => (
          <span className={"token-" + types[lineKey][tokeni]} key={tokeni}>
            {token}
          </span>
        ));

      const { lineHeight } = dimensions || {};

      const anyLine = lineTuple.any();
      const pad = maxLineCount.toString().replace(/./g, " ");
      const lineNumber = anyLine
        ? (pad + anyLine.lineNumber).slice(-pad.length)
        : "";
      const lineNumberElement = showNumbers && (
        <span className={"token-line-number"}>{lineNumber + " "}</span>
      );
      const hideRowClass = (t: number) => {
        if (t % 1 > 0) {
          if (nextLine && nextLine.isTransition && nextLine.skipRows) {
            return 'hide-row';
          }
        } else if (anyLine && anyLine.skipRows) {
          return 'hide-row';
        }
        return 'show-row'
      };

      const lineElement = isStatic && (
        <Styled.CodeLine
          className={`${hideRowClass(0)} static-row`}
          style={{
            overflow: "hidden",
            opacity: prevFocus ? undefined : offOpacity,
            height: lineHeight
          }}
          key={lineKey}
        >
          {lineNumberElement}
          <div
            style={{ display: "inline-block" }}
            className={`cs-line cs-line-${lineKey}`}
          >
            {tokenElements}
          </div>
        </Styled.CodeLine>
      );

      let getLineStyle: StyleAnimation = emptyStyle;
      if (!isStatic) {
        if (!prevLine) {
          const fadeInIndex = fadeInLines.indexOf(lineKey);
          const fromOpacity = Array.isArray(nextFocus) ? 1 : 0;
          const toOpacity = nextFocus ? 1 : offOpacity;
          getLineStyle = enterLine(
            fromOpacity,
            toOpacity,
            fadeInIndex,
            fadeInLines.length,
            lineHeight
          );
        } else if (!nextLine) {
          const fadeOutIndex = fadeOutLines.indexOf(lineKey);
          const fromOpacity = prevFocus ? 1 : offOpacity;
          const toOpacity = Array.isArray(prevFocus) ? 1 : 0;
          getLineStyle = exitLine(
            fromOpacity,
            toOpacity,
            fadeOutIndex,
            fadeOutLines.length,
            lineHeight
          );
        } else if (!prevSkipRows && nextSkipRows) {
          var _toOpacity = Array.isArray(prevFocus) ? 1 : 0;
          if (!nextLine.isTransition) {
            var fadeOutIndex = fadeOutLines.indexOf(lineKey);
            var _fromOpacity = prevFocus ? 1 : offOpacity;
            getLineStyle = exitLine(_fromOpacity, _toOpacity, fadeOutIndex, fadeOutLines.length, lineHeight);
          } else {
            var focusStyle = unfocus(offOpacity, offOpacity);
            if (prevFocus) {
              focusStyle = unfocus(1, _toOpacity);
            }
            getLineStyle = (t: number) => ({ ...focusStyle(t), height: lineHeight });
          }
        } else if (prevSkipRows && !nextSkipRows) {
          var toOpacity = nextFocus ? 1 : offOpacity;
          if (prevLine.isTransition) {
            var focusStyle = unfocus(offOpacity, offOpacity);
            if (prevFocus) {
              focusStyle = unfocus(1, toOpacity);
            }
            getLineStyle = (t: number) => ({ ...focusStyle(t), height: lineHeight });
          } else {
            var fadeInIndex = fadeInLines.indexOf(lineKey);
            var fromOpacity = Array.isArray(nextFocus) ? 1 : 0;
            getLineStyle = enterLine(fromOpacity, toOpacity, fadeInIndex, fadeInLines.length, lineHeight);
          }
        } else if (!prevFocus && nextFocus && !Array.isArray(nextFocus)) {
          const fadeInIndex = fadeInLines.indexOf(lineKey);
          getLineStyle = fadeInFocus(
            offOpacity,
            1,
            fadeInIndex,
            fadeInLines.length
          );
        } else if (prevFocus && !nextFocus && !Array.isArray(prevFocus)) {
          const fadeOutIndex = fadeOutLines.indexOf(lineKey);
          getLineStyle = fadeOutFocus(
            1,
            offOpacity,
            fadeOutIndex,
            fadeOutLines.length
          );
        }
      }

      let getTokenStyle: (t: number, i: number) => CSSProperties = emptyStyle;
      if (!areTokensStatic) {
        const fromFocus = tokens[lineKey].map((_, tokeni) =>
          Array.isArray(prevFocus) ? prevFocus.includes(tokeni) : prevFocus
        );
        const toFocus = tokens[lineKey].map((_, tokeni) =>
          Array.isArray(nextFocus) ? nextFocus.includes(tokeni) : nextFocus
        );
        const fadeInIndex = fadeInLines.indexOf(lineKey);
        const fadeOutIndex = fadeOutLines.indexOf(lineKey);
        getTokenStyle = (t, i) => {
          const fromOpacity = !prevLine ? 0 : fromFocus[i] ? 1 : offOpacity;
          const toOpacity = !nextLine ? 0 : toFocus[i] ? 1 : offOpacity;
          const animation =
            fromOpacity < toOpacity
              ? fadeInFocus(
                fromOpacity,
                toOpacity,
                fadeInIndex,
                fadeInLines.length
              )
              : fadeOutFocus(
                fromOpacity,
                toOpacity,
                fadeOutIndex,
                fadeOutLines.length
              );
          return animation(t);
        };
      }

      return {
        lineKey,
        lineElement,
        tokenElements,
        getLineStyle,
        getTokenStyle,
        lineNumberElement,
        hideRowClass
      };
    });
  }, [stepPair]);

  return (
    <React.Fragment>
      {lines.map(
        ({
          lineElement,
          lineKey,
          tokenElements,
          getLineStyle,
          getTokenStyle,
          lineNumberElement,
          hideRowClass
        }) =>
          lineElement || (
            <Styled.CodeLine
              className={hideRowClass(t)}
              style={{ overflow: "hidden", ...getLineStyle(t) }}
              key={lineKey}
            >
              <div
                style={{ display: "inline-block" }}
                className={`cs-line cs-line-${lineKey}`}
              >
                {lineNumberElement}
                {tokenElements ||
                  tokens[lineKey].map((token, tokeni) => (
                    <span
                      className={"token-" + types[lineKey][tokeni]}
                      style={getTokenStyle!(t, tokeni)}
                      key={tokeni}
                    >
                      {token}
                    </span>
                  ))}
              </div>
            </Styled.CodeLine>
          )
      )}
    </React.Fragment>
  );
}
