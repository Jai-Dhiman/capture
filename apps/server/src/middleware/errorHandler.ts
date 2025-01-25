export const errorHandler = (err: Error, c: any) => {
  console.error(`${err}`)
  return c.json(
    {
      error: err.message || 'Internal Server Error',
    },
    500
  )
}
