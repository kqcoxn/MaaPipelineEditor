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

const IconNamijiqiren: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M270.490566 318.792453C270.490566 185.401962 378.609509 77.283019 512 77.283019S753.509434 185.401962 753.509434 318.792453V656.90566a135.245283 135.245283 0 0 1-135.245283 135.245283H405.735849a135.245283 135.245283 0 0 1-135.245283-135.245283V318.792453z"
        fill={getIconColor(color, 0, '#64EDAC')}
      />
      <path
        d="M840.45283 540.981132a48.301887 48.301887 0 0 0-48.301887-48.301887H231.849057A48.301887 48.301887 0 0 0 183.54717 540.981132v270.490566h-57.962264V540.981132a106.264151 106.264151 0 0 1 106.264151-106.264151h560.301886a106.264151 106.264151 0 0 1 106.264151 106.264151v270.490566h-57.962264V540.981132z"
        fill={getIconColor(color, 1, '#333C50')}
      />
      <path
        d="M222.188679 908.075472a67.622642 67.622642 0 1 0-135.245283 0 28.981132 28.981132 0 0 1-57.962264 0 125.584906 125.584906 0 1 1 251.169811 0 28.981132 28.981132 0 0 1-57.962264 0zM937.056604 908.075472a67.622642 67.622642 0 1 0-135.245283 0 28.981132 28.981132 0 0 1-57.962264 0 125.584906 125.584906 0 1 1 251.169811 0 28.981132 28.981132 0 0 1-57.962264 0z"
        fill={getIconColor(color, 2, '#333C50')}
      />
      <path
        d="M425.056604 309.132075m-28.981132 0a28.981132 28.981132 0 1 0 57.962264 0 28.981132 28.981132 0 1 0-57.962264 0Z"
        fill={getIconColor(color, 3, '#333C50')}
      />
      <path
        d="M598.943396 309.132075m-28.981132 0a28.981132 28.981132 0 1 0 57.962264 0 28.981132 28.981132 0 1 0-57.962264 0Z"
        fill={getIconColor(color, 4, '#333C50')}
      />
    </svg>
  );
};

IconNamijiqiren.defaultProps = {
  size: 18,
};

export default IconNamijiqiren;
