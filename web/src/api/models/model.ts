export abstract class Model<TResource> {
  constructor(protected readonly _data: TResource) {}

  get $raw(): TResource {
    return this._data
  }

  static collection<TRes, M extends Model<TRes>>(this: new (raw: TRes) => M, raws: TRes[]): M[] {
    return raws.map((raw) => new this(raw))
  }
}
