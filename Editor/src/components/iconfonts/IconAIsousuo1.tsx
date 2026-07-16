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

const IconAIsousuo1: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M467.456 0c257.706667 0 467.285333 212.053333 467.285333 472.832a474.112 474.112 0 0 1-102.144 294.826667l175.274667 166.741333c20.565333 19.626667 21.589333 52.309333 2.218667 73.301333a51.2 51.2 0 0 1-72.533334 2.218667L760.32 841.130667a461.738667 461.738667 0 0 1-292.864 104.618666C209.749333 945.749333 0 733.696 0 472.832 0 212.053333 209.749333 0 467.456 0z m0 103.509333C266.24 103.509333 102.4 269.312 102.4 472.832 102.4 676.437333 266.24 842.24 467.456 842.24S832.426667 676.608 832.426667 472.746667c0-203.690667-163.84-369.322667-364.970667-369.322667zM249.344 421.034667c28.330667 0 51.2 23.210667 51.2 51.797333 0 93.269333 74.922667 168.96 166.997333 168.96a51.797333 51.797333 0 0 1-0.085333 103.509333c-148.48 0.085333-269.312-122.112-269.312-272.469333 0-28.586667 22.869333-51.797333 51.2-51.797333z"
        fill={getIconColor(color, 0, '#FF851E')}
      />
    </svg>
  );
};

IconAIsousuo1.defaultProps = {
  size: 18,
};

export default IconAIsousuo1;
