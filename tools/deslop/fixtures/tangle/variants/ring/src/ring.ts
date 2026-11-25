export interface Alpha {
  next?: Bravo;
}

export interface Bravo {
  next?: Charlie;
}

export interface Charlie {
  next?: Delta;
}

export interface Delta {
  next?: Echo;
}

export interface Echo {
  next?: Foxtrot;
}

export interface Foxtrot {
  next?: Golf;
}

export interface Golf {
  next?: Hotel;
}

export interface Hotel {
  next?: Alpha;
}
