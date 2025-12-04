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

const IconA11Maodian1: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512 202.496C341.0432 202.496 202.496 341.0176 202.496 512S341.0176 821.504 512 821.504 821.504 682.9824 821.504 512 682.9824 202.496 512 202.496z"
        fill={getIconColor(color, 0, '#089FA6')}
        opacity=".1"
      />
      <path
        d="M512 25.6c24.4224 0 44.2112 19.7888 44.2112 44.2112V116.48c184.4736 20.3776 330.9312 166.8352 351.3088 351.3088h46.6688a44.2112 44.2112 0 0 1 0 88.4224H907.52c-20.3776 184.4736-166.8352 330.9312-351.3088 351.3088v46.6688a44.2112 44.2112 0 1 1-88.4224 0V907.52c-184.448-20.3776-330.9056-166.8352-351.3088-351.3088H69.8112a44.2112 44.2112 0 1 1 0-88.4224H116.48c20.3776-184.4736 166.8352-330.9312 351.3088-351.3088V69.8112C467.7888 45.3888 487.5776 25.6 512 25.6z m0 176.896C341.0432 202.496 202.496 341.0176 202.496 512S341.0176 821.504 512 821.504 821.504 682.9824 821.504 512 682.9824 202.496 512 202.496z"
        fill={getIconColor(color, 1, '#089FA6')}
        opacity=".5"
      />
      <path
        d="M512 357.248a154.752 154.752 0 1 1 0 309.504 154.752 154.752 0 0 1 0-309.504z"
        fill={getIconColor(color, 2, '#089FA6')}
      />
    </svg>
  );
};

IconA11Maodian1.defaultProps = {
  size: 18,
};

export default IconA11Maodian1;
