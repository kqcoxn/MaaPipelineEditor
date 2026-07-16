/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconZanting: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M514 912c-219.9 0-398.9-178.9-398.9-398.9 0-219.9 178.9-398.8 398.9-398.8 219.9 0 398.8 178.9 398.8 398.8 0 220-178.9 398.9-398.8 398.9z m0-701.5c-166.9 0-302.7 135.8-302.7 302.7S347.1 815.9 514 815.9s302.7-135.8 302.7-302.7S680.9 210.5 514 210.5z"
        fill={getIconColor(color, 0, '#BDD2EF')}
      />
      <path
        d="M419.6 704.5c-32.5 0-58.8-26.3-58.8-58.8V381.4c0-32.5 26.3-58.8 58.8-58.8s58.8 26.3 58.8 58.8v264.4c0 32.4-26.3 58.7-58.8 58.7zM608.4 704.5c-32.5 0-58.8-26.3-58.8-58.8V381.4c0-32.5 26.3-58.8 58.8-58.8s58.8 26.3 58.8 58.8v264.4c-0.1 32.4-26.4 58.7-58.8 58.7z"
        fill={getIconColor(color, 1, '#2867CE')}
      />
    </svg>
  );
};

IconZanting.defaultProps = {
  size: 18,
};

export default IconZanting;
