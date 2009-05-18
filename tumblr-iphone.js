(function(){

if (window.bookmarkletAlreadyExecuted)
  return;
window.bookmarkletAlreadyExecuted = true;

var isIPhoneView = (window.location.pathname.indexOf('/iphone') == 0);

function $(id) {
  return document.getElementById(id);
}

function $x(xpath, context) {
  context = context || document;
  var retval = [];
  var result = document.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  var node;
  while ((node = result.iterateNext()) != null)
    retval.push(node);
  return retval;
}

function doXMLHttpRequest(options) {
  var client = new XMLHttpRequest();
  if (typeof options.data == 'string') {
    var method = 'POST';
    var data = options.data;
  }
  else {
    var method = 'GET';
    var data = null;
  }
  client.open(method, options.uri);
  if (typeof options.header == 'object')
    for (var name in options.header)
      client.setRequestHeader(name, options.header[name]);

  var timeoutId = null;
  if (typeof options.onError == 'function') {
    var timeoutHandler = function() {
      client.onreadystatechange = null;
      client.abort();
      options.onError(client);
    };
    var timeout = 1000 * 60 * 5;
    timeoutId = window.setTimeout(timeoutHandler, timeout);
  }

  client.onreadystatechange = function() {
    if (timeoutId)
      window.clearTimeout(timeoutId);
    if (client.readyState == 4) {
      if (client.status >= 200 && client.status < 300) {
        if (typeof options.onLoad == 'function')
          options.onLoad(client);
      }
      else {
        if (typeof options.onError == 'function')
          options.onError(client);
      }
    }
    else if (timeoutId)
      timeoutId = window.setTimeout(timeoutHandler, timeout);
  };

  client.send(data);
}

function reblog(uri, popup) {
  if (popup && isIPhoneView) {
    window.open(uri)
    return;
  }
  doXMLHttpRequest({
    uri: uri,
    onLoad: function(response) {
      var formExp = /<form action="\/reblog[\s\S]*?<\/form>/; //"
      var div = document.createElement('div');
      div.innerHTML = response.responseText.match(formExp)[0];
      var form = new Form(div.firstChild);
      form.onError = function() {
        if (window.confirm('Failed to reblog the post. Retry?'))
          form.submit();
      };
      if (popup)
        form.show();
      else
        form.submit();
    },
    onError: function() {
      if (window.confirm('Failed to reblog the post. Retry?'))
        reblog(uri, popup);
    }
  });
}

function StyleSheet() {
  this.style = document.createElement('style');
  this.style.type = 'text/css';
  $x('//head')[0].appendChild(this.style);
}

StyleSheet.prototype.add = function(rule) {
  this.style.sheet.insertRule(rule, 0);
};

function Cover(opacity) {
  this.element = document.createElement('div');
  this.element.className = 'cover';
  this.element.style.opacity = opacity;
  this.clickListener = null;
}

Cover.prototype.show = function() {
  var self = this;
  this.refresh();
  this.scrollListener = function(event) {
    self.refresh();
  };
  document.body.appendChild(this.element);
  window.addEventListener('scroll', this.scrollListener, false);
};

Cover.prototype.hide = function() {
  window.removeEventListener('scroll', this.scrollListener, false);
  document.body.removeChild(this.element);
};

Cover.prototype.refresh = function() {
  this.element.style.top = postsNode.offsetTop + 'px';
  this.element.style.height = (paginationNode.offsetTop + paginationNode.offsetHeight - postsNode.offsetTop) + 'px';
}

Cover.prototype.onClick = function(listener) {
  if (this.clickListener) {
    this.element.removeEventListener('click', this.clickListener, false);
    this.clickListener = null;
  }
  if (typeof listener == 'function') {
    this.element.addEventListener('click', listener, false);
    this.clickListener = listener;
  }
};

function Form(element) {
  this.element = element;
}

Form.urlencode = function(s) {
  return encodeURIComponent(s).replace('%20', '+');
};

Form.generateBoundary = function() {
  var length = 20;
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'()+_,-./:=?";
  var retval = '';
  for (var i = 0; i < length; i++)
    retval += chars.charAt(Math.floor(Math.random() * chars.length));
  return retval;
};

Form.prototype.extractData = function() {
  var form = this.element;
  var retval = [];
  var submitAppeared = false;
  for (var i = 0; i < form.length; i++) {
    var elem = form.elements[i];
    if (elem.disabled || ((elem.type == 'submit' || elem.type == 'image') && submitAppeared))
      continue;
    if (elem.type == 'submit' || elem.type == 'image')
      submitAppeared = true;
    if (!elem.name)
      continue;
    switch (elem.type) {
    case 'text':
    case 'password':
    case 'submit':
    case 'hidden':
    case 'image':
    case 'button':
    case 'textarea':
      retval.push({ name: elem.name, value: elem.value });
      break;
    case 'checkbox':
    case 'radio':
      if (elem.checked)
        retval.push({ name: elem.name, value: elem.value });
      break;
    case 'select-multiple':
      if (elem.selectedIndex != -1)
        for (var i = elem.selectedIndex; i < elem.length; i++)
          if (elem.options[i].selected)
            retval.push({ name: elem.name, value: elem.options[i].value });
      break;
    case 'select-one':
      if (elem.selectedIndex != -1)
        retval.push({ name: elem.name, value: elem.options[elem.selectedIndex].value });
      break;
    }
  }
  return retval;
};

Form.prototype.submit = function() {
  var form = this.element;
  var data = this.extractData();
  if (form.enctype == 'multipart/form-data') {
    for (;;) {
      var boundary = Form.generateBoundary();
      if (data.every(function(e) { return e.value.indexOf(boundary) == -1 }))
        break;
    }
    var contentType = 'multipart/form-data; boundary="' + boundary + '"';
    var dashBoundary = '--' + boundary;
    var delimiter = '\r\n' + dashBoundary;
    var body = dashBoundary + '\r\n' + data.map(function(e) {
      return 'Content-Disposition: form-data; name="' + e.name + '"\r\n\r\n' + e.value;
    }).join(delimiter + '\r\n') + delimiter + '--';
  }
  else {
    var contentType = 'application/x-www-form-urlencoded';
    var body = data.map(function(e) {
      return Form.urlencode(e.name) + '=' + Form.urlencode(e.value);
    }).join('&');
  }

  doXMLHttpRequest({
    uri: form.action,
    header: { 'Content-Type': contentType },
    data: body,
    onLoad: this.onLoad,
    onError: this.onError
  });
};

Form.prototype.show = function() {
  var self = this;
  $x('.//div[@id="left_column"]', this.element)[0].style.width = '400px';
  if (!this.submitListener) {
    this.submitListener = function(event) {
      self.hide();
      self.submit();
      event.preventDefault();
    };
    this.element.addEventListener('submit', this.submitListener, false);
  }
  this.container = document.createElement('div');
  this.container.className = 'form_container';
  this.container.style.top = window.pageYOffset + 'px';
  this.container.appendChild(this.element);
  this.cover = new Cover(0.5);
  this.cover.show();
  document.body.appendChild(this.container);
  this.cover.onClick(function(event) { self.hide(); });
  this.scrollListener = function(event) {
    if (self.container.offsetTop > window.pageYOffset + window.innerHeight
      || self.container.offsetTop + self.container.offsetHeight < window.pageYOffset)
      self.container.style.top = window.pageYOffset + 'px';
  };
  window.addEventListener('scroll', this.scrollListener, false);
};

Form.prototype.hide = function() {
  if (isIPhoneView)
    return;
  document.body.removeChild(this.container);
  this.cover.hide();
  window.removeEventListener('scroll', this.scrollListener, false);
};

function Pager() {
  var self = this;
  if (isIPhoneView) {
    this.paginationNode = $('footer');
    this.postsExp = /<ul id="posts">([\s\S]*)<\/ul>\s*<div id="footer">/;
  }
  else {
    this.paginationNode = $('pagination');
    this.postsExp = /<!-- Posts -->\s*<ol id="posts" ?>([\s\S]*)<\/ol>\s*<!-- No posts found -->/;
  }
  this.paginationNode = isIPhoneView ? $('footer') : $('pagination');
  this.nextLinkNode = $x('./a[contains(text(),"Next page")]', this.paginationNode)[0];
  this.curUri = window.location.pathname;
  if (window.location.hash) {
    var range = document.createRange();
    range.selectNodeContents($('posts'));
    range.deleteContents();
    range.detach();
    this.nextUri = decodeURIComponent(window.location.hash.slice(1));
    this.minPostId = Infinity;
    window.setTimeout(function() { self.loadNext(); }, 0);
  }
  else {
    this.nextUri = this.nextLinkNode.href;
    var posts = $('posts');
    $x('./text()', posts).forEach(function(text) { posts.removeChild(text); });
    var last = $x('id("posts")/*[last()]')[0];
    this.minPostId = Number(last.id.match(/\d+/)[0]);
  }
  this.auto = true;
  this.inProgress = false;
  this.failure = false;
  this.nextLinkNode.addEventListener('click', function(event) {
    if (self.loadNext())
      event.preventDefault();
  }, false);
  window.addEventListener('scroll', Pager.scrollListener, false);
}

Pager.scrollListener = function() {
  if (window.pageYOffset == 0) {
    var posts = $('posts');
    var padding = $x('./*[@class="padding"]', posts)[0];
    if (padding)
      posts.removeChild(padding);
  }
};

Pager.prototype.loadNext = function() {
  var self = this;
  if (this.inProgress || !this.nextUri)
    return false;
  this.inProgress = true;
  this.failure = false;
  doXMLHttpRequest({
    uri: this.nextUri,
    onLoad: function(response) {
      var text = response.responseText;
      var div = document.createElement('div');
      div.innerHTML = text.match(self.postsExp)[1];
      var postsNode = $('posts');
      var newPosts = $x('./*', div);
      for (var i = newPosts.length - 1; i >= 0; i--)
        if (newPosts[i].id.match(/(\d+)/) != null && Number(RegExp.$1) >= self.minPostId)
          break;

      if (i == newPosts.length - 1)
        window.setTimeout(function() { self.loadNext(); }, 0);
      else {
        if (i != -1)
          newPosts.splice(0, i + 1);
        self.minPostId = Number(newPosts[newPosts.length - 1].id.match(/\d+/)[0]);
        var fragment = document.createDocumentFragment();
        newPosts.forEach(function(post) { fragment.appendChild(post); });
        postsNode.appendChild(fragment);
        window.setTimeout(function() { self.removePassedPosts(); }, 0);
      }
      var nextNodeExp = /<a href="([^"]*)"[^>]*>Next page &#8594;<\/a>/; //"
      var nextUri = (text.match(nextNodeExp) == null) ? null : (self.nextLinkNode.href = RegExp.$1);
      window.location.hash = encodeURIComponent(self.curUri.match(/(?:http:\/\/www\.tumblr\.com)?(\/.*)/)[1]);
      self.curUri = self.nextUri;
      self.nextUri = nextUri;
      self.inProgress = false;
    },
    onError: function() {
      self.inProgress = false;
      self.failure = true;
    }
  });
  return true;
};

Pager.prototype.removePassedPosts = function() {
  var postsNode = $('posts');
  var posts = $x('id("posts")/*[contains(@class,"post")][not(contains(@class,"controls"))]');
  var maxPostNum = 23;
  var removedNum = Math.max(posts.length - maxPostNum, 0);
  if (removedNum > 0) {
    var remain = posts[removedNum];
    var removed = [];
    var elem;
    for (var i = 0; (elem = postsNode.childNodes[i]) != remain; i++)
      removed.push(elem);
    var padding = document.createElement('li');
    padding.className = 'padding';
    postsNode.insertBefore(padding, postsNode.firstChild);
    removed.forEach(function(elem) { padding.appendChild(elem); });
    padding.style.height = (remain.offsetTop - padding.offsetTop) + 'px';
    var range = document.createRange();
    range.selectNodeContents(padding);
    range.deleteContents();
    range.detach();
  }
};

Pager.prototype.enableAuto = function() {
  this.auto = true;
};

Pager.prototype.disableAuto = function() {
  this.auto = false;
};

function PostIterator() {
  var self = this;
  this.listeners = [];
  this.refresh();
  window.addEventListener('scroll', function() { self.refresh(); }, false);
}

PostIterator.prototype.getCurrent = function() {
  return this.current;
};

PostIterator.prototype.prev = function() {
  var xpath = '(preceding-sibling::*[contains(@class,"post")][not(contains(@class,"controls"))])[last()]';
  if (this.current) {
    var prev = $x(xpath, this.current)[0];
    if (prev) {
      this.setCurrent(prev);
      return prev;
    }
  }
  return null;
};

PostIterator.prototype.next = function() {
  var xpath = 'following-sibling::*[contains(@class,"post")][not(contains(@class,"controls"))]';
  if (this.current) {
    var followings = $x(xpath, this.current);
    var next = followings[0];
    if (next) {
      this.setCurrent(next);
      if (followings.length <= 10)
        pager.loadNext();
      return next;
    }
  }
  return null;
};

PostIterator.prototype.setCurrent = function(current) {
  this.current = current;
  this.listeners.forEach(function(listener) { listener(current); });
};

PostIterator.prototype.refresh = function() {
  if (this.current && this.current.offsetTop == window.pageYOffset)
    return;
  var posts = $x('id("posts")/*[contains(@class,"post")][not(contains(@class,"controls"))]');
  for (var i = 0; i < posts.length; i++)
    if (posts[i].offsetTop >= window.pageYOffset
      || posts[i].offsetTop + posts[i].offsetHeight >= window.pageYOffset + window.innerHeight / 2)
      break;
  this.setCurrent(posts[i]);
  if (posts.length - i <= 10)
    pager.loadNext();
};

PostIterator.prototype.addListener = function(listener) {
  this.listeners.push(listener);
};

function ActionDispatcher() {
  this.topLeft = this.topRight = this.buttomLeft = this.bottomRight = ActionDispatcher.actions.nothing;
  this.quadEnabled = false;
  ($('left_column') || $('posts')).addEventListener('click', ActionDispatcher.listenerBasic, true);
}

ActionDispatcher.actions = [
  {
    name: 'prev',
    longName: 'previous post',
    action: function() {
      var current = postIterator.getCurrent();
      if (current.offsetTop < window.pageYOffset)
        window.scrollTo(0, current.offsetTop);
      else {
        var prev = postIterator.prev();
        window.scrollTo(0, (prev ? prev.offsetTop : 0));
      }
    }
  },
  {
    name: 'next',
    longName: 'next post',
    action: function() {
      var current = postIterator.getCurrent();
      if (current.offsetTop > window.pageYOffset)
        window.scrollTo(0, current.offsetTop);
      else {
        var next = postIterator.next();
        window.scrollTo(0, (next ? next.offsetTop : document.body.offsetHeight));
      }
      Pager.scrollListener();
    }
  },
  {
    name: 'reblog',
    longName: 'reblog',
    action: function() {
      (new Post(postIterator.getCurrent())).reblog();
    }
  },
  {
    name: 'form',
    longName: 'reblog-form',
    action: function() {
      (new Post(postIterator.getCurrent())).reblog(true);
    }
  },
/*
  {
    name: 'comment',
    longName: 'reblog with comment',
    action: function() {
    }
  },
  {
    name: 'private',
    longName: 'reblog as private',
    action: function() {
    }
  },
  {
    name: 'like',
    longName: 'like',
    action: function() {
    }
  },
  // reblog with user defined preset ("Post to", "Publishing options", etc.)
  {
    name: 'preset',
    longName: 'preset',
    action: function() {
    }
  },
  {
    name: 'open',
    longName: 'open the post',
    action: function() {
    }
  },
  {
    name: 'source',
    longName: 'open the source',
    action: function() {
    }
  },
  {
    name: 'choice',
    longName: 'choice',
    action: function() {
    }
  },
*/
  {
    name: 'nothing',
    longName: 'nothing',
    action: function() {}
  }
];

ActionDispatcher.actions.forEach(function(action) {
  ActionDispatcher.actions[action.name] = action;
});

ActionDispatcher.listenerBasic = function(event) {
  var target = event.target;

  if ($x('ancestor-or-self::a[@href="#"] | ancestor::form', target)[0])
    return;

  if (target.tagName == 'A') {
    if (target.href.indexOf('http://www.tumblr.com/reblog/') == 0)
      reblog(target.href, true);
    else
      window.open(target.href);
    event.preventDefault();
    return;
  }

  if (target.tagName == 'BUTTON' && target.onclick.toString().match(/location\.href\s*=\s*['"]([\/\w]+)['"]/)) { //"
    reblog(RegExp.$1, true);
    event.stopPropagation();
    return;
  }

  var post = $x('ancestor-or-self::li[parent::*[@id="posts"]]', target)[0];
  if (post) {
    (new Post(post)).reblog();
    event.preventDefault();
  }
};

ActionDispatcher.prototype.set = function(topLeft, topRight, bottomLeft, bottomRight) {
  this.topLeft = ActionDispatcher.actions[topLeft];
  this.topRight = ActionDispatcher.actions[topRight];
  this.bottomLeft = ActionDispatcher.actions[bottomLeft];
  this.bottomRight = ActionDispatcher.actions[bottomRight];
};

ActionDispatcher.prototype.enableQuad = function(enable) {
  if (arguments.length == 0)
    enable = true;
  if (this.quadEnabled == enable)
    return;
  if (enable) {
    var self = this;
    this.cover = new Cover(0.0);
    this.cover.show();
    this.cover.onClick(function(event) {
      var x = event.pageX - window.pageXOffset;
      var y = event.pageY - window.pageYOffset;
      var vertical = (y < window.innerHeight / 2) ? 'top' : 'bottom';
      var horizontal = (x < window.innerWidth / 2) ? 'Left' : 'Right';
      self[vertical + horizontal].action();
      event.stopPropagation();
      event.preventDefault();
    });
    ($('left_column') || $('posts')).removeEventListener('click', ActionDispatcher.listenerBasic, true);
  }
  else {
    ($('left_column') || $('posts')).addEventListener('click', ActionDispatcher.listenerBasic, true);
    this.cover.hide();
  }
  this.quadEnabled = Boolean(enable);
};

ActionDispatcher.prototype.disableQuad = function() {
  this.enableQuad(false);
};

function Post(element) {
  this.element = element;
}

Post.prototype.reblog = function(popup) {
  var post = this.element;
  var control = isIPhoneView ?
    $(post.id.replace('post', 'post_controls')) : $x('./*[@class="post_controls"]', post)[0];
  if (control && control.innerHTML.match(/(\/reblog\/\w+\/\w+)/))
    reblog(RegExp.$1, popup);
};

function Preferences() {
  var self = this;
  var addButton = function() {
    var showPrefNode = document.createElement('div');
    var showPrefButton = document.createElement('input');
    showPrefButton.type = 'button';
    showPrefButton.name = 'show_menu';
    showPrefButton.value = 'Preferences';
    showPrefButton.addEventListener('click', function(event) {
      self.showDialog();
    }, false);
    showPrefNode.appendChild(showPrefButton);
    postsNode.parentNode.insertBefore(showPrefNode, postsNode);
    self.listeners.forEach(function(listener) { listener(); });
  };
  this.table = {
    enableActions: false,
    topLeftAction: 'form',
    topRightAction: 'prev',
    bottomLeftAction: 'reblog',
    bottomRightAction: 'next'
  };
  this.listeners = [];
  if (window.openDatabase) {
    try {
      this.db = window.openDatabase('Rebloglet', '1.0', 'Rebloglet', 1024 * 1024);
      this.db.transaction(function(transaction) {
        transaction.executeSql(
          "CREATE TABLE IF NOT EXISTS preferences(key TEXT, value TEXT, CONSTRAINT pk_prefs PRIMARY KEY (key));"
        );
        transaction.executeSql(
          "SELECT * FROM preferences;", null,
          function(transaction, results) {
            for (var i = 0; i < results.rows.length; i++) {
              var row = results.rows.item(i);
              self.table[row['key']] = row['value'];
            }
          }
        );
      }, addButton, addButton);
    }
    catch (e) {
      addButton();
    }
  }
  else
    addButton();
}

Preferences.prototype.get = function(key, defaultValue) {
  if (key in this.table)
    return this.table[key];
  else
    return defaultValue;
};

Preferences.prototype.set = function(key, value) {
  this.table[key] = String(value);
};

Preferences.prototype.dump = function() {
  for (var key in this.table)
    console.log(key + ': ' + this.table[key] + ', ');
};

Preferences.prototype.save = function() {
  var self = this;
  if (this.db) {
    this.db.transaction(function(transaction) {
      for (var key in self.table) {
        transaction.executeSql(
          "INSERT OR REPLACE INTO preferences(key, value) VALUES (?, ?);", [ key, self.table[key] ]
        );
      }
    });
  }
};

Preferences.prototype.addListener = function(listener) {
  this.listeners.push(listener);
};

Preferences.prototype.showDialog = function() {
  var self = this;
  var cover = new Cover(0.5);
  cover.show();
  var div = document.createElement('div');
  div.className = 'menu';
  div.style.position = 'absolute';
  div.style.top = '0';
  div.style.left = '0';
  div.style.backgroundColor = '#fff';
  div.innerHTML =
    '<form action="#">'
    + '<fieldset>'
    +   '<input type="checkbox" name="enableActions" value="enable_actions"' + (self.get('enableActions') == 'true' ? ' checked="checked"' : '') + '/>'
    +   '<label for="enableActions">execute action when each section is tapped</label>'
    +   '<table>'
    +     [ 'top left', 'top right', 'bottom left', 'bottom right' ].map(function(section) {
            var name = section.replace(/ ./, function(s) { return s.charAt(1).toUpperCase(); }) + 'Action';
            return '<tr><td><label for="' + name + '">' + section + '</label></td><td><select name="' + name + '">'
              + ActionDispatcher.actions.map(function(action) {
                  return '<option value="' + action.name + '"'
                    + (self.get(name) == action.name ? ' selected="selected"' : '') + '>' + action.longName + '</option>';
                }).join('')
              + '</select></td></tr>';
          }).join('')
    +   '</table>'
    + '</fieldset>'
    + '<input type="submit" value="OK"/>'
    + '<input type="button" name="cancel" value="Cancel"/>'
    +'</form>';
  var form = div.firstChild;
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    for (var i = 0; i < form.length; i++) {
      var elem = form.elements[i];
      switch (elem.type) {
      case 'checkbox':
        self.set(elem.name, elem.checked);
        break;
      case 'select-one':
        self.set(elem.name, elem.value);
        break;
      }
    }
    document.body.removeChild(div);
    cover.hide();
    self.save();
    self.listeners.forEach(function(listener) { listener(); });
  }, false);
  $x('./input[@name="cancel"]', form)[0].addEventListener('click', function(event) {
    document.body.removeChild(div);
    cover.hide();
  }, false);
  document.body.appendChild(div);
};

if (window.navigator.userAgent.indexOf('AppleWebKit') != -1 && window.navigator.userAgent.indexOf('Mobile') != -1) {
  window.scrollTo_ = window.scrollTo;
  window.scrollTo = function(x, y) {
    window.scrollTo_(x, y);
    var event = document.createEvent('HTMLEvents');
    event.initEvent('scroll', true, false);
    document.dispatchEvent(event);
  };
}

var styleSheet = new StyleSheet();
styleSheet.add('.cover {' + [
  'position: absolute',
  'top: 0',
  'left: 0',
  'width: 100%',
  'background-color: #000',
'}'].join(';'));
styleSheet.add('.form_container {' + [
  'position: absolute',
  'left: 0',
  'width: 100%',
  'background-color: #fff',
'}'].join(';'));
styleSheet.add('.form_container input { max-width: 80%; }');
styleSheet.add('.form_container .wide { width: 100%; }');
styleSheet.add('.form_container img { max-width: 100%; }');
styleSheet.add('.form_container div[id=right_column] { background-color: #777; }');

if (!isIPhoneView) {
  Ajax.PeriodicalUpdater.prototype.onTimerEvent = function() {};
  document.body.onclick = null;

  [ $('header_container'), $('content_top'), $('right_column'), $('content_bottom'), $('footer') ]
    .forEach(function(node) { node.parentNode.removeChild(node); });

  $('pagination').style.padding = '0';
  $('container').style.width = '665px';
  $('container').style.padding = '0';
  $('container').style.overflowX = 'hidden';
  $x('//meta[@name="viewport"]')[0].content = 'width = 665';
}

var postsNode = $('posts');
var paginationNode = isIPhoneView ? $('footer') : $('pagination');

var pager = new Pager();
var actionDispatcher = new ActionDispatcher();
var postIterator = new PostIterator();
postIterator.addListener(function(current) {
  if (actionDispatcher.current)
    actionDispatcher.current.style.backgroundColor = '#fff';
  actionDispatcher.current = current;
  if (actionDispatcher.quadEnabled && actionDispatcher.current)
    actionDispatcher.current.style.backgroundColor = '#cfc';
});

if (isIPhoneView) {
  var prefs = new Preferences();
  prefs.addListener(function() {
    actionDispatcher.enableQuad(prefs.get('enableActions') == 'true');
    [ 'topLeft', 'topRight', 'bottomLeft', 'bottomRight' ].forEach(function(section) {
      actionDispatcher[section] = ActionDispatcher.actions[prefs.get(section + 'Action')];
    });
  });
  prefs.addListener(function() { postIterator.refresh(); });
}

})();
