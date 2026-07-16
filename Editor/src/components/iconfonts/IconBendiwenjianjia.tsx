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

const IconBendiwenjianjia: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M367.146667 183.466667a36.906667 36.906667 0 0 1 29.866666 15.36l120.533334 170.666666c4.565333 6.421333 11.946667 10.24 19.84 10.24h300.8A36.48 36.48 0 0 1 874.666667 416.853333V804.266667a36.48 36.48 0 0 1-36.48 36.48H185.813333A36.48 36.48 0 0 1 149.333333 804.266667V219.733333c0.128-20.053333 16.426667-36.266667 36.48-36.266666h181.333334z m165.482666 329.472a33.045333 33.045333 0 0 0-43.733333 2.218666l-105.173333 102.912-1.792 1.984a21.333333 21.333333 0 0 0 1.472 28.181334l16.362666 16.725333 1.984 1.792a21.333333 21.333333 0 0 0 28.16-1.472l49.066667-47.957333V840.746667h66.069333V617.301333l49.024 48 2.026667 1.728a21.333333 21.333333 0 0 0 28.16-2.069333l16.362667-16.725333 1.749333-2.026667a21.333333 21.333333 0 0 0-2.090667-28.16l-105.173333-102.890667zM770.133333 237.44a24.32 24.32 0 0 1 23.68 24.32v68.266667H570.24a24.32 24.32 0 0 1-19.84-10.026667l-57.6-82.56h277.333333z"
        fill={getIconColor(color, 0, '#327DFF')}
      />
    </svg>
  );
};

IconBendiwenjianjia.defaultProps = {
  size: 18,
};

export default IconBendiwenjianjia;
