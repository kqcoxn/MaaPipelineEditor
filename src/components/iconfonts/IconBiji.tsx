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

const IconBiji: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M808.9 150.2H276c-43.1 0-78 35.9-78 80.3V794c0 44.4 34.9 80.3 78 80.3h527.3c11.6 0 20.9-9.4 20.9-20.9V165.5c0-8.4-6.9-15.3-15.3-15.3z m-521.5 44.2h154.5v294.1l-64.2-47.9-10.9-8.2-11.1 7.9-68.3 49V194.4zM785 834H275.9s-39.7-7-38.9-40.3c0-20.1 17.5-40.2 38.9-40.2H785V834z"
        fill={getIconColor(color, 0, '#3259CE')}
      />
    </svg>
  );
};

IconBiji.defaultProps = {
  size: 18,
};

export default IconBiji;
