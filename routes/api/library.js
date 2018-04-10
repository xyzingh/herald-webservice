const cheerio = require('cheerio')

exports.route = {

  /**
  * GET /api/library
  * @apiParam password
  * 图书馆信息查询
  **/
  async get({ password }) {
    return await this.userCache('1m+', async () => {
      let { cardnum } = this.user
      password = password || this.user.password

      // 获取解析后的验证码与Cookie并登陆
      let captcha = await this.libraryCaptcha()

      let log = await this.post(
        'http://www.libopac.seu.edu.cn:8080/reader/redr_verify.php',
        { number: cardnum, passwd: password, captcha: captcha, select: 'cert_no'}
      )

      // 判断是否登录成功
      if (/密码错误/.test(log.data)) {
        throw '密码错误，请重试'
      }

      // 当前借阅
      res = await this.get(
        'http://www.libopac.seu.edu.cn:8080/reader/book_lst.php'
      )
      let $ = cheerio.load(res.data)
      let bookList = $('#mylib_content tr').toArray().slice(1).map(tr => {
        let [bookId, name, borrowDate, returnDate, renewCount, location, addition]
        = $(tr).find('td').toArray().map(td => {
          return $(td).text().trim()
        })

        let borrowId = $(tr).find('input').attr('onclick').substr(20,8)

        return { bookId, name, borrowDate, returnDate, renewCount, location, addition, borrowId }
      })

      return {
        bookList,
        cookies: this.cookieJar.getCookieStringSync('http://www.libopac.seu.edu.cn')
      }
    })
  },

  /**
  * POST /api/library
  * @apiParam cookies
  * @apiParam bookId
  * @apiParam borrowId
  * 图书续借
  **/
    async post({ cookies, bookId, borrowId }) {
      let time = new Date().getTime()

      // 获取解析后的验证码和Cookies
      this.cookieJar.parse(cookies)
      let captcha = await this.libraryCaptcha()

      res = await this.get(
        'http://www.libopac.seu.edu.cn:8080/reader/ajax_renew.php', {
          params: {
            bar_code: bookId,
            check: borrowId,
            captcha, time
          }
        }
      )
      let $ = cheerio.load(res.data)

      // 返回续借状态
      return $.text()
    }
}